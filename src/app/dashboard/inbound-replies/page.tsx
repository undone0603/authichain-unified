'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface InboundReply {
  id: string;
  leadEmail: string;
  senderName?: string;
  subject: string;
  sentiment: string;
  objectionType?: string;
  matchConfidence: number;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export default function InboundRepliesDashboard() {
  const [replies, setReplies] = useState<InboundReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchReplies();
  }, [sentimentFilter, statusFilter, page]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (sentimentFilter !== 'all') params.append('sentiment', sentimentFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/dashboard/replies?${params}`);
      if (!response.ok) throw new Error('Failed to fetch replies');

      const data = await response.json();
      setReplies(data.replies || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateReplyStatus = async (replyId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/dashboard/replies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replyId, status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update reply');
      fetchReplies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'negative':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'objection':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      case 'objection':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deal_won':
        return 'bg-green-100 text-green-800';
      case 'disqualified':
        return 'bg-red-100 text-red-800';
      case 'contacted':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbound Proposal Replies</h1>
        <p className="text-gray-600">Monitor and nurture customer responses to proposals</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Sentiment</label>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="objection">Objection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="deal_won">Deal Won</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Replies ({replies.length})</CardTitle>
          <CardDescription>Double-click a sentiment or status to update | Match confidence shows proposal match quality</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-600">Loading replies...</p>
          ) : replies.length === 0 ? (
            <p className="text-gray-600">No replies found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replies.map((reply) => (
                    <TableRow key={reply.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div>
                          <p>{reply.senderName || 'Unknown'}</p>
                          <p className="text-xs text-gray-600">{reply.leadEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-xs truncate">{reply.subject}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSentimentIcon(reply.sentiment)}
                          <Badge className={getSentimentColor(reply.sentiment)}>
                            {reply.sentiment}
                            {reply.objectionType && ` - ${reply.objectionType}`}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{Math.round(reply.matchConfidence * 100)}%</p>
                          {reply.matchConfidence < 0.7 && (
                            <p className="text-xs text-orange-600">Review needed</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(reply.status)}>{reply.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {format(new Date(reply.createdAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => updateReplyStatus(reply.id, 'contacted')}
                          >
                            Mark Contacted
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => updateReplyStatus(reply.id, 'deal_won')}
                          >
                            Deal Won
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Page {page}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button variant="outline" onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
