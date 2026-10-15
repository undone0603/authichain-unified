"""
AgentZ Browser Layer Orchestrator skill module.
Provides layer analysis, modal overlay management, and layer focus/context preservation across web application UI workflows.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


class LayerRole(Enum):
    """Enumeration of browser/UI layout layers."""
    L0_MODAL_NOTIFICATIONS = "L0_MODAL_NOTIFICATIONS"
    L1_COMMAND_BAR = "L1_COMMAND_BAR"
    L2_EXPLORER = "L2_EXPLORER"
    L3_EDITOR_CANVAS = "L3_EDITOR_CANVAS"
    L4_TERMINAL_PANEL = "L4_TERMINAL_PANEL"
    L5_STATUS_BAR = "L5_STATUS_BAR"


def _z_index_for(role: "LayerRole") -> int:
    """Stacking order derived from the layer name (L0 on top ... L5 at the bottom)."""
    try:
        return int(role.name[1])
    except (ValueError, IndexError):
        return 0


@dataclass
class LayerState:
    """State of an individual UI layer.

    ``active`` / ``visible`` are canonical; ``is_active`` / ``is_visible`` remain
    as aliases so earlier callers keep working.
    """

    role: LayerRole
    active: bool = False
    visible: bool = True
    has_blocking_overlay: bool = False
    buffer_dirty: bool = False
    context_data: Dict[str, Any] = field(default_factory=dict)
    z_index: int = 0

    @property
    def is_active(self) -> bool:
        return self.active

    @is_active.setter
    def is_active(self, value: bool) -> None:
        self.active = bool(value)

    @property
    def is_visible(self) -> bool:
        return self.visible

    @is_visible.setter
    def is_visible(self, value: bool) -> None:
        self.visible = bool(value)


@dataclass
class ViewportStateContract:
    """Contract representing full viewport multi-layer state and overlay status."""
    layers: Dict[LayerRole, LayerState] = field(default_factory=dict)
    active_layer: Optional[LayerRole] = None
    blocking_overlays_count: int = 0
    buffers_saved: bool = True

    def is_clean_state(self) -> bool:
        return self.blocking_overlays_count == 0 and self.buffers_saved

    def get_all_layer_states(self) -> List[LayerState]:
        """Every layer L0..L5 in order; layers not tracked yet get a default state."""
        return [
            self.layers[role] if role in self.layers else LayerState(role=role, z_index=_z_index_for(role))
            for role in LayerRole
        ]




class BrowserLayerOrchestrator:
    """Orchestrates webpage UI layers, analyzes modal overlays, and preserves focus/context."""

    def __init__(self) -> None:
        self.layers: Dict[LayerRole, LayerState] = {
            role: LayerState(role=role, z_index=_z_index_for(role)) for role in LayerRole
        }
        self.active_layer: Optional[LayerRole] = LayerRole.L4_TERMINAL_PANEL

    def analyze_layers(self, raw_elements: Optional[List[Dict[str, Any]]] = None) -> ViewportStateContract:
        """Analyze current webpage layer status and active overlays."""
        blocking_count = sum(1 for l in self.layers.values() if l.has_blocking_overlay)
        buffers_ok = all(not l.buffer_dirty for l in self.layers.values())
        return ViewportStateContract(
            layers=self.layers.copy(),
            active_layer=self.active_layer,
            blocking_overlays_count=blocking_count,
            buffers_saved=buffers_ok,
        )

    def handle_modal_overlays(self) -> int:
        """Dismiss/handle blocking modal overlays on L0/L1 layers."""
        resolved = 0
        for role in [LayerRole.L0_MODAL_NOTIFICATIONS, LayerRole.L1_COMMAND_BAR]:
            if self.layers[role].has_blocking_overlay:
                self.layers[role].has_blocking_overlay = False
                resolved += 1
        return resolved

    def preserve_context(self, target_layer: LayerRole) -> None:
        """Switch active focus to target_layer while preserving state across other layers."""
        if self.active_layer and self.active_layer in self.layers:
            self.layers[self.active_layer].is_active = False
        self.active_layer = target_layer
        if target_layer in self.layers:
            self.layers[target_layer].is_active = True

    def get_layer_states(self) -> List[LayerState]:
        """All layer states in L0..L5 order."""
        return [self.layers[role] for role in LayerRole]

    def get_active_layer(self) -> Optional[LayerRole]:
        return self.active_layer

    def focus_layer(self, role) -> LayerState:
        """Focus a layer (LayerRole or its name) while preserving the other layers' state."""
        if isinstance(role, str):
            role = LayerRole[role]
        self.preserve_context(role)
        return self.layers[role]

    def has_blocking_modals(self) -> bool:
        return any(state.has_blocking_overlay for state in self.layers.values())

    def dismiss_modals(self) -> List[LayerRole]:
        """Dismiss every blocking overlay; returns the roles that were cleared."""
        dismissed: List[LayerRole] = []
        for role, state in self.layers.items():
            if state.has_blocking_overlay:
                state.has_blocking_overlay = False
                dismissed.append(role)
        return dismissed
