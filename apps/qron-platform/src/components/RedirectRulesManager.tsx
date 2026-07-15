'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Save, X, Loader2 } from 'lucide-react';

interface RedirectRule {
  id: string;
  qron_id: string;
  user_id: string;
  name: string;
  priority: number;
  rule_type:
    | 'default'
    | 'device'
    | 'time'
    | 'location'
    | 'language'
    | 'referrer'
    | 'a_b'; // Added 'a_b'
  configuration: { [key: string]: unknown }; // JSONB structure
  is_active: boolean;
  start_time?: string | null; // Added for time-based rules
  end_time?: string | null; // Added for time-based rules
  a_b_variant?: string | null; // Added for A/B rules
  a_b_weight?: number | null; // Added for A/B rules
}

interface RedirectRulesManagerProps {
  qronId: string;
  userId: string;
}

export function RedirectRulesManager({
  qronId,
  userId,
}: RedirectRulesManagerProps) {
  const [rules, setRules] = useState<RedirectRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<RedirectRule>>({
    qron_id: qronId,
    user_id: userId,
    name: '',
    priority: 100,
    rule_type: 'default',
    configuration: {},
    is_active: true,
    start_time: null,
    end_time: null,
    a_b_variant: null,
    a_b_weight: 1,
  });
  const supabase = createClient();

  const fetchRules = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase
      .from('redirect_rules')
      .select('*')
      .eq('qron_id', qronId)
      .order('priority', { ascending: true });

    if (error) {
      toast.error('Failed to fetch redirect rules: ' + error.message);
      console.error('Error fetching redirect rules:', error);
    } else {
      const formattedData = (data || []).map((rule) => ({
        ...rule,
        start_time: rule.start_time
          ? new Date(rule.start_time).toISOString().slice(0, 16)
          : null,
        end_time: rule.end_time
          ? new Date(rule.end_time).toISOString().slice(0, 16)
          : null,
      }));
      setRules(formattedData as RedirectRule[]);
    }
    setLoading(false);
  }, [qronId, supabase]);

  useEffect(() => {
    let isMounted = true;
    const loadRules = async () => {
      const { data, error } = await supabase
        .from('redirect_rules')
        .select('*')
        .eq('qron_id', qronId)
        .order('priority', { ascending: true });

      if (!isMounted) return;

      if (error) {
        toast.error('Failed to fetch redirect rules: ' + error.message);
      } else {
        const formattedData = (data || []).map((rule) => ({
          ...rule,
          start_time: rule.start_time
            ? new Date(rule.start_time).toISOString().slice(0, 16)
            : null,
          end_time: rule.end_time
            ? new Date(rule.end_time).toISOString().slice(0, 16)
            : null,
        }));
        setRules(formattedData as RedirectRule[]);
      }
      setLoading(false);
    };

    loadRules();
    return () => { isMounted = false; };
  }, [qronId, supabase]);

  const handleAddRule = async () => {
    if (!newRule.name) {
      toast.error('Rule name is required.');
      return;
    }
    if (!newRule.configuration?.redirect_url && newRule.rule_type !== 'a_b') {
      toast.error('Redirect URL is required for this rule type.');
      return;
    }
    if (newRule.rule_type === 'a_b' && !newRule.a_b_variant) {
      toast.error('A/B Variant name is required for A/B rule type.');
      return;
    }

    setLoading(true);
    const ruleToInsert = {
      ...newRule,
      start_time: newRule.start_time
        ? new Date(newRule.start_time).toISOString()
        : null,
      end_time: newRule.end_time
        ? new Date(newRule.end_time).toISOString()
        : null,
      a_b_weight:
        newRule.rule_type === 'a_b' && newRule.a_b_weight
          ? newRule.a_b_weight
          : 1, // Default to 1 for A/B if not set
    };
    const { error } = await supabase.from('redirect_rules').insert(ruleToInsert);
    if (error) {
      toast.error('Failed to add rule: ' + error.message);
      console.error('Error adding rule:', error);
    } else {
      toast.success('Rule added successfully!');
      setNewRule({
        qron_id: qronId,
        user_id: userId,
        name: '',
        priority: 100,
        rule_type: 'default',
        configuration: {},
        is_active: true,
        start_time: null,
        end_time: null,
        a_b_variant: null,
        a_b_weight: 1,
      });
      fetchRules();
    }
    setLoading(false);
  };

  const handleUpdateRule = async (rule: RedirectRule) => {
    if (!rule.name) {
      toast.error('Rule name is required.');
      return;
    }
    if (!rule.configuration?.redirect_url && rule.rule_type !== 'a_b') {
      toast.error('Redirect URL is required for this rule type.');
      return;
    }
    if (rule.rule_type === 'a_b' && !rule.a_b_variant) {
      toast.error('A/B Variant name is required for A/B rule type.');
      return;
    }

    setLoading(true);
    const ruleToUpdate = {
      name: rule.name,
      priority: rule.priority,
      rule_type: rule.rule_type,
      configuration: rule.configuration,
      is_active: rule.is_active,
      start_time: rule.start_time
        ? new Date(rule.start_time).toISOString()
        : null,
      end_time: rule.end_time ? new Date(rule.end_time).toISOString() : null,
      a_b_variant: rule.rule_type === 'a_b' ? rule.a_b_variant : null,
      a_b_weight: rule.rule_type === 'a_b' ? rule.a_b_weight : null,
    };
    const { error } = await supabase
      .from('redirect_rules')
      .update(ruleToUpdate)
      .eq('id', rule.id)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to update rule: ' + error.message);
      console.error('Error updating rule:', error);
    } else {
      toast.success('Rule updated successfully!');
      setEditingRuleId(null);
      fetchRules();
    }
    setLoading(false);
  };

  const handleDeleteRule = async (ruleId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('redirect_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to delete rule: ' + error.message);
      console.error('Error deleting rule:', error);
    } else {
      toast.success('Rule deleted successfully!');
      fetchRules();
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <span className="ml-2 text-slate-400">Loading rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Redirect Rules for {qronId}</h3>

      {/* Add New Rule Form */}
      <div className="protocol-card p-4 space-y-3">
        <h4 className="text-lg font-medium">Add New Rule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Rule Name
            </label>
            <input
              type="text"
              className="protocol-input w-full px-3 py-2"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="e.g., iOS App Store Redirect"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Priority</label>
            <input
              type="number"
              className="protocol-input w-full px-3 py-2"
              value={newRule.priority}
              onChange={(e) =>
                setNewRule({ ...newRule, priority: parseInt(e.target.value) })
              }
              placeholder="100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Rule Type
            </label>
            <select
              className="protocol-input w-full px-3 py-2"
              value={newRule.rule_type}
              onChange={(e) =>
                setNewRule({
                  ...newRule,
                  rule_type: e.target.value as RedirectRule['rule_type'],
                })
              }
            >
              <option value="default">Default</option>
              <option value="device">Device</option>
              <option value="time">Time-based</option>
              <option value="a_b">A/B Test</option>
            </select>
          </div>
          {newRule.rule_type === 'device' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Device Type
              </label>
              <select
                className="protocol-input w-full px-3 py-2"
                value={(newRule.configuration?.device as string) || ''}
                onChange={(e) =>
                  setNewRule({
                    ...newRule,
                    configuration: { ...newRule.configuration, device: e.target.value },
                  })
                }
              >
                <option value="">Select Device</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
                <option value="desktop">Desktop</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          )}
          {newRule.rule_type === 'time' && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Start Time (UTC)
                </label>
                <input
                  type="datetime-local"
                  className="protocol-input w-full px-3 py-2"
                  value={newRule.start_time || ''}
                  onChange={(e) =>
                    setNewRule({ ...newRule, start_time: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  End Time (UTC, Optional)
                </label>
                <input
                  type="datetime-local"
                  className="protocol-input w-full px-3 py-2"
                  value={newRule.end_time || ''}
                  onChange={(e) =>
                    setNewRule({ ...newRule, end_time: e.target.value || null })
                  }
                />
              </div>
            </>
          )}
          {newRule.rule_type === 'a_b' && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  A/B Variant Name
                </label>
                <input
                  type="text"
                  className="protocol-input w-full px-3 py-2"
                  value={newRule.a_b_variant || ''}
                  onChange={(e) =>
                    setNewRule({ ...newRule, a_b_variant: e.target.value })
                  }
                  placeholder="e.g., Variant A"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  A/B Weight (1-100)
                </label>
                <input
                  type="number"
                  className="protocol-input w-full px-3 py-2"
                  value={newRule.a_b_weight || 1}
                  onChange={(e) =>
                    setNewRule({ ...newRule, a_b_weight: parseInt(e.target.value) })
                  }
                  min="1"
                  max="100"
                />
              </div>
            </>
          )}
          {newRule.rule_type !== 'a_b' && ( // A/B rules don't need a single redirect_url in configuration, it's determined by variant
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">
                Redirect URL
              </label>
              <input
                type="url"
                className="protocol-input w-full px-3 py-2"
                value={(newRule.configuration?.redirect_url as string) || ''}
                onChange={(e) =>
                  setNewRule({
                    ...newRule,
                    configuration: {
                      ...newRule.configuration,
                      redirect_url: e.target.value,
                    },
                  })
                }
                placeholder="https://your-redirect-url.com"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAddRule}
            className="btn-gold flex items-center gap-1 text-sm py-2 px-4"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
      </div>

      {/* Existing Rules List */}
      <div className="protocol-card p-4 space-y-4">
        <h4 className="text-lg font-medium">Existing Rules ({rules.length})</h4>
        {rules.length === 0 ? (
          <p className="text-sm text-slate-400 text-center">
            No redirect rules defined yet.
          </p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="bg-zinc-900/50 p-3 rounded-lg flex items-center justify-between border border-zinc-800"
              >
                {editingRuleId === rule.id ? (
                  // Edit mode
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">
                        Name
                      </label>
                      <input
                        type="text"
                        className="protocol-input w-full px-2 py-1 text-sm"
                        value={rule.name}
                        onChange={(e) =>
                          setRules(
                            rules.map((r) =>
                              r.id === rule.id ? { ...r, name: e.target.value } : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">
                        Priority
                      </label>
                      <input
                        type="number"
                        className="protocol-input w-full px-2 py-1 text-sm"
                        value={rule.priority}
                        onChange={(e) =>
                          setRules(
                            rules.map((r) =>
                              r.id === rule.id
                                ? { ...r, priority: parseInt(e.target.value) }
                                : r
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">
                        Rule Type
                      </label>
                      <select
                        className="protocol-input w-full px-2 py-1 text-sm"
                        value={rule.rule_type}
                        onChange={(e) =>
                          setRules(
                            rules.map((r) =>
                              r.id === rule.id
                                ? {
                                    ...r,
                                    rule_type: e.target
                                      .value as RedirectRule['rule_type'],
                                  }
                                : r
                            )
                          )
                        }
                      >
                        <option value="default">Default</option>
                        <option value="device">Device</option>
                        <option value="time">Time-based</option>
                        <option value="a_b">A/B Test</option>
                      </select>
                    </div>
                    {rule.rule_type === 'device' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">
                          Device
                        </label>
                        <select
                          className="protocol-input w-full px-2 py-1 text-sm"
                          value={(rule.configuration?.device as string) || ''}
                          onChange={(e) =>
                            setRules(
                              rules.map((r) =>
                                r.id === rule.id
                                  ? {
                                      ...r,
                                      configuration: {
                                        ...r.configuration,
                                        device: e.target.value,
                                      },
                                    }
                                  : r
                              )
                            )
                          }
                        >
                          <option value="">Select Device</option>
                          <option value="mobile">Mobile</option>
                          <option value="tablet">Tablet</option>
                          <option value="desktop">Desktop</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      </div>
                    )}
                    {rule.rule_type === 'time' && (
                      <>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">
                            Start Time (UTC)
                          </label>
                          <input
                            type="datetime-local"
                            className="protocol-input w-full px-2 py-1 text-sm"
                            value={rule.start_time || ''}
                            onChange={(e) =>
                              setRules(
                                rules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, start_time: e.target.value }
                                    : r
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">
                            End Time (UTC, Optional)
                          </label>
                          <input
                            type="datetime-local"
                            className="protocol-input w-full px-2 py-1 text-sm"
                            value={rule.end_time || ''}
                            onChange={(e) =>
                              setRules(
                                rules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, end_time: e.target.value || null }
                                    : r
                                )
                              )
                            }
                          />
                        </div>
                      </>
                    )}
                    {rule.rule_type === 'a_b' && (
                      <>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">
                            A/B Variant Name
                          </label>
                          <input
                            type="text"
                            className="protocol-input w-full px-2 py-1 text-sm"
                            value={rule.a_b_variant || ''}
                            onChange={(e) =>
                              setRules(
                                rules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, a_b_variant: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder="e.g., Variant A"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">
                            A/B Weight (1-100)
                          </label>
                          <input
                            type="number"
                            className="protocol-input w-full px-2 py-1 text-sm"
                            value={rule.a_b_weight || 1}
                            onChange={(e) =>
                              setRules(
                                rules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, a_b_weight: parseInt(e.target.value) }
                                    : r
                                )
                              )
                            }
                            min="1"
                            max="100"
                          />
                        </div>
                      </>
                    )}
                    {rule.rule_type !== 'a_b' && (
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-0.5">
                          Redirect URL
                        </label>
                        <input
                          type="url"
                          className="protocol-input w-full px-2 py-1 text-sm"
                          value={(rule.configuration?.redirect_url as string) || ''}
                          onChange={(e) =>
                            setRules(
                              rules.map((r) =>
                                r.id === rule.id
                                  ? {
                                      ...r,
                                      configuration: {
                                        ...r.configuration,
                                        redirect_url: e.target.value,
                                      },
                                    }
                                  : r
                              )
                            )
                          }
                          placeholder="https://your-redirect-url.com"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  // View mode
                  <div className="flex-1">
                    <p className="text-slate-200 font-medium">
                      {rule.name}{' '}
                      <span className="text-slate-500 text-xs">
                        {' '}
                        (Prio: {rule.priority})
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Type: {rule.rule_type}{' '}
                      {rule.rule_type === 'device' &&
                        `(${rule.configuration?.device || 'Any'})`}{' '}
                      {rule.rule_type === 'time' &&
                        `(${rule.start_time ? new Date(rule.start_time).toLocaleString() : ''} - ${rule.end_time ? new Date(rule.end_time).toLocaleString() : 'Never'})`}{' '}
                      {rule.rule_type === 'a_b' &&
                        `(${rule.a_b_variant || 'Variant'} - Weight: ${rule.a_b_weight || 1})`}
                    </p>
                    <p className="text-xs gold-text truncate">
                      {(rule.configuration as { redirect_url?: string })
                        ?.redirect_url || 'N/A'}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 ml-4">
                  {editingRuleId === rule.id ? (
                    <>
                      <button
                        onClick={() => handleUpdateRule(rule as RedirectRule)}
                        className="text-green-500 hover:text-green-400"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingRuleId(null)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingRuleId(rule.id)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
