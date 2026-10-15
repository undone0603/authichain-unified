"""Unit tests for BrowserLayerOrchestrator, LayerRole, LayerState, ViewportStateContract, and Runner/CLI integration."""

import pytest
from agentz.skills.browser_layer_orchestrator import (
    LayerRole,
    LayerState,
    ViewportStateContract,
    BrowserLayerOrchestrator
)
from agentz.workflows.runner import WorkflowRunner
from agentz.cli import main, create_parser

def test_layer_role_enum():
    assert LayerRole.L0_MODAL_NOTIFICATIONS.value == "L0_MODAL_NOTIFICATIONS"
    assert LayerRole.L1_COMMAND_BAR.value == "L1_COMMAND_BAR"
    assert LayerRole.L2_EXPLORER.value == "L2_EXPLORER"
    assert LayerRole.L3_EDITOR_CANVAS.value == "L3_EDITOR_CANVAS"
    assert LayerRole.L4_TERMINAL_PANEL.value == "L4_TERMINAL_PANEL"
    assert LayerRole.L5_STATUS_BAR.value == "L5_STATUS_BAR"

def test_layer_state_dataclass():
    ls = LayerState(role=LayerRole.L4_TERMINAL_PANEL, active=True, visible=True, z_index=4)
    assert ls.role == LayerRole.L4_TERMINAL_PANEL
    assert ls.active is True
    assert ls.visible is True
    assert ls.z_index == 4

def test_viewport_state_contract():
    contract = ViewportStateContract()
    states = contract.get_all_layer_states()
    assert len(states) >= 6
    roles = [s.role for s in states]
    assert LayerRole.L0_MODAL_NOTIFICATIONS in roles
    assert LayerRole.L4_TERMINAL_PANEL in roles

def test_browser_layer_orchestrator_identification_and_focus():
    orchestrator = BrowserLayerOrchestrator()
    layers = orchestrator.get_layer_states()
    assert len(layers) >= 6

    # Focus L4_TERMINAL_PANEL
    focused = orchestrator.focus_layer(LayerRole.L4_TERMINAL_PANEL)
    assert focused.role == LayerRole.L4_TERMINAL_PANEL
    assert orchestrator.get_active_layer() == LayerRole.L4_TERMINAL_PANEL

    # Preserve context across L0-L5
    orchestrator.focus_layer(LayerRole.L2_EXPLORER)
    assert orchestrator.get_active_layer() == LayerRole.L2_EXPLORER

    orchestrator.focus_layer(LayerRole.L3_EDITOR_CANVAS)
    assert orchestrator.get_active_layer() == LayerRole.L3_EDITOR_CANVAS

def test_modal_overlay_gating_and_handling():
    orchestrator = BrowserLayerOrchestrator()
    
    # Check blocking modals detection/gating
    has_modals = orchestrator.has_blocking_modals()
    assert isinstance(has_modals, bool)

    # Dismiss modals
    dismissed = orchestrator.dismiss_modals()
    assert isinstance(dismissed, list)
    assert not orchestrator.has_blocking_modals()

def test_workflow_runner_integration():
    runner = WorkflowRunner()
    result = runner.run_browser_layer_workflow({"target_layer": "L4_TERMINAL_PANEL", "handle_modals": True})
    assert result["status"] == "success"
    assert result["active_layer"] == "L4_TERMINAL_PANEL"
    assert result["context_preserved"] is True

    res2 = runner.run_workflow("browser_layer", {"target_layer": "L4_TERMINAL_PANEL"})
    assert res2["status"] == "success"
    assert res2["active_layer"] == "L4_TERMINAL_PANEL"

def test_cli_integration(capsys):
    parser = create_parser()
    args = parser.parse_args(["browser-layer", "--layer", "L4_TERMINAL_PANEL"])
    assert args.command == "browser-layer"
    assert args.layer == "L4_TERMINAL_PANEL"

    exit_code = main(["browser-layer", "--layer", "L4_TERMINAL_PANEL"])
    assert exit_code == 0
    captured = capsys.readouterr()
    assert "Browser layer orchestration result" in captured.out
