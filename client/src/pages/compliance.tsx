import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Plus, Upload, Trash2, Phone, MessageCircle, Search, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { DNCEntry } from "@shared/schema";

export default function CompliancePage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    phone: "",
    channels: { call: true, whatsapp: true },
    source: "manual",
  });

  const { data: dncEntries, isLoading } = useQuery<DNCEntry[]>({
    queryKey: ["/api/compliance/dnc"],
  });

  const addEntryMutation = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      return apiRequest("POST", "/api/compliance/dnc", entry);
    },
    onSuccess: () => {
      toast({ title: "Entry added to DNC list" });
      setAddDialogOpen(false);
      setNewEntry({ phone: "", channels: { call: true, whatsapp: true }, source: "manual" });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/dnc"] });
    },
    onError: () => {
      toast({ title: "Failed to add entry", variant: "destructive" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/compliance/dnc/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Entry removed from DNC list" });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/dnc"] });
    },
    onError: () => {
      toast({ title: "Failed to remove entry", variant: "destructive" });
    },
  });

  const filteredEntries = dncEntries?.filter((entry) =>
    entry.phone.includes(searchQuery)
  );

  const columns = [
    {
      key: "phone",
      header: "Phone Number",
      render: (entry: DNCEntry) => <span className="font-medium font-mono">{entry.phone}</span>,
    },
    {
      key: "channels",
      header: "Blocked Channels",
      render: (entry: DNCEntry) => (
        <div className="flex items-center gap-2">
          {entry.channels.call && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Calls
            </Badge>
          )}
          {entry.channels.whatsapp && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (entry: DNCEntry) => (
        <Badge variant="secondary" className="capitalize">
          {entry.source}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Added On",
      render: (entry: DNCEntry) => (
        <span className="text-sm text-muted-foreground">
          {format(entry.createdAt, "MMM d, yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (entry: DNCEntry) => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-delete-${entry.id}`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from DNC List?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {entry.phone} from the Do Not Call list. They may receive calls and messages again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteEntryMutation.mutate(entry.id)}
                data-testid="button-confirm-delete"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Compliance</h1>
          <p className="text-muted-foreground">Manage Do Not Call (DNC) list and compliance settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-md bg-destructive/10">
                <Shield className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total DNC Entries</p>
                <p className="text-2xl font-bold">{dncEntries?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-md bg-chart-1/10">
                <Phone className="h-6 w-6 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Call Blocks</p>
                <p className="text-2xl font-bold">
                  {dncEntries?.filter((e) => e.channels.call).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-md bg-chart-2/10">
                <MessageCircle className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp Blocks</p>
                <p className="text-2xl font-bold">
                  {dncEntries?.filter((e) => e.channels.whatsapp).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Do Not Call List
              </CardTitle>
              <CardDescription>
                Numbers that are blocked from receiving calls and messages
              </CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-entry">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to DNC List</DialogTitle>
                  <DialogDescription>
                    Add a phone number to the Do Not Call list
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      value={newEntry.phone}
                      onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })}
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Block Channels</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="block-calls"
                          checked={newEntry.channels.call}
                          onCheckedChange={(checked) =>
                            setNewEntry({
                              ...newEntry,
                              channels: { ...newEntry.channels, call: !!checked },
                            })
                          }
                          data-testid="checkbox-calls"
                        />
                        <Label htmlFor="block-calls" className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          Calls
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="block-whatsapp"
                          checked={newEntry.channels.whatsapp}
                          onCheckedChange={(checked) =>
                            setNewEntry({
                              ...newEntry,
                              channels: { ...newEntry.channels, whatsapp: !!checked },
                            })
                          }
                          data-testid="checkbox-whatsapp"
                        />
                        <Label htmlFor="block-whatsapp" className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addEntryMutation.mutate(newEntry)}
                    disabled={!newEntry.phone || addEntryMutation.isPending}
                    data-testid="button-save-entry"
                  >
                    Add to DNC List
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredEntries || []}
            isLoading={isLoading}
            emptyMessage="No entries in DNC list"
          />
        </CardContent>
      </Card>
    </div>
  );
}
