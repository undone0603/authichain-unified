import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, RefreshCcw, AlertCircle, CheckCircle2, Clock, Terminal } from "lucide-react";
import { toast } from "sonner";

interface WorkflowState {
  file: string;
  run_id: string;
  workflow_id: string;
  status: string;
  current_step: string;
  started_at: string;
  completed_at?: string;
  results: Record<string, any>;
  parameters: Record<string, any>;
}

export default function AgentControl() {
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/states');
      const data = await res.json();
      if (Array.isArray(data)) {
        setStates(data);
      } else {
        toast.error("Failed to load workflow states");
      }
    } catch (e) {
      toast.error("API Error: Could not connect to Agent Control Center");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStates();
  }, []);

  const handleResume = async (workflow_id: string, run_id: string) => {
    try {
      const res = await fetch('/api/agents/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id, run_id, action: 'resume' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Resuming ${run_id}...`);
        fetchStates();
      } else {
        toast.error(data.error || "Resume failed");
      }
    } catch (e) {
      toast.error("Network error occurred");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Terminal className="h-8 w-8 text-primary" />
            Agent Control Center
          </h1>
          <p className="text-muted-foreground">Monitor and manage autonomous state machines</p>
        </div>
        <Button onClick={fetchStates} disabled={loading} variant="outline">
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh States
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Active Runs</CardTitle>
            <CardDescription>Workflows currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{states.filter(s => s.status === 'running').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
            <CardDescription>Successful workflow exits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{states.filter(s => s.status === 'completed').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed / Stalled</CardTitle>
            <CardDescription>Requires manual intervention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-500">{states.filter(s => s.status === 'failed').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>Real-time state of all AgentZ workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Run ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Step</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Loading state machine data...</TableCell>
                </TableRow>
              ) : states.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">No workflow states found in logs.</TableCell>
                </TableRow>
              ) : (
                states.map((s) => (
                  <TableRow key={s.run_id}>
                    <TableCell className="font-medium">{s.workflow_id}</TableCell>
                    <TableCell className="font-mono text-xs">{s.run_id}</TableCell>
                    <TableCell>
                      <Badge variant={
                        s.status === 'completed' ? 'success' : 
                        s.status === 'failed' ? 'destructive' : 
                        s.status === 'running' ? 'default' : 'secondary'
                      }>
                        {s.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : 
                         s.status === 'failed' ? <AlertCircle className="h-3 w-3 mr-1" /> : 
                         <Clock className="h-3 w-3 mr-1" />}
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.current_step || 'N/A'}</TableCell>
                    <TableCell className="text-xs">{new Date(s.started_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {s.status !== 'completed' && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleResume(s.workflow_id, s.run_id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
