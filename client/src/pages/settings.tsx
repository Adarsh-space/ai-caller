import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Settings,
  User,
  Building,
  Bell,
  Key,
  Globe,
  Save,
  MessageCircle,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Trash2,
  Star,
  PhoneOutgoing,
  PhoneIncoming,
} from "lucide-react";
import type { TenantPhone } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const [tenantData, setTenantData] = useState({
    name: tenant?.name || "",
    timezone: tenant?.timezone || "America/New_York",
    currency: tenant?.currency || "USD",
  });

  const [notifications, setNotifications] = useState({
    emailCalls: true,
    emailWhatsApp: true,
    emailBilling: true,
    pushCalls: false,
    pushWhatsApp: true,
  });

  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("");
  const [pendingPhoneId, setPendingPhoneId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");

  const { data: telephonyStatus, isLoading: telephonyLoading, refetch: refetchTelephony } = useQuery<{
    configured: boolean;
    phoneNumbers: string[];
  }>({
    queryKey: ["/api/telephony/status"],
  });

  const { data: tenantPhones = [], isLoading: phonesLoading } = useQuery<TenantPhone[]>({
    queryKey: ["/api/telephony/phone-numbers"],
  });

  const startVerificationMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; label?: string }) => {
      return apiRequest("POST", "/api/telephony/phone-numbers/start", data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setPendingPhoneId(data.id);
      setNewPhoneNumber("");
      setNewPhoneLabel("");
      toast({ title: "Verification code sent", description: "Check server logs for the OTP code (demo mode)" });
    },
    onError: () => {
      toast({ title: "Failed to start verification", variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { phoneId: string; otpCode: string }) => {
      return apiRequest("POST", "/api/telephony/phone-numbers/verify", data);
    },
    onSuccess: () => {
      setPendingPhoneId(null);
      setOtpInput("");
      toast({ title: "Phone number verified successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/phone-numbers"] });
    },
    onError: () => {
      toast({ title: "Invalid verification code", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: "outbound" | "inbound" }) => {
      return apiRequest("PATCH", `/api/telephony/phone-numbers/${id}/default`, { type });
    },
    onSuccess: () => {
      toast({ title: "Default phone updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/phone-numbers"] });
    },
    onError: () => {
      toast({ title: "Failed to set default", variant: "destructive" });
    },
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/telephony/phone-numbers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Phone number removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/telephony/phone-numbers"] });
    },
    onError: () => {
      toast({ title: "Failed to remove phone number", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      return apiRequest("PATCH", "/api/users/me", data);
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: typeof tenantData) => {
      return apiRequest("PATCH", "/api/tenants/current", data);
    },
    onSuccess: () => {
      toast({ title: "Business settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2" data-testid="tab-business">
            <Building className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="telephony" className="flex items-center gap-2" data-testid="tab-telephony">
            <Phone className="h-4 w-4" />
            Telephony
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2" data-testid="tab-whatsapp">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2" data-testid="tab-api">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <Badge variant="outline">{user?.role}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>
              </div>

              <Button
                onClick={() => updateProfileMutation.mutate(profileData)}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" data-testid="input-current-password" />
                </div>
                <div />
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" data-testid="input-new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" data-testid="input-confirm-password" />
                </div>
              </div>
              <Button variant="outline" data-testid="button-change-password">
                Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Settings</CardTitle>
              <CardDescription>Configure your business preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={tenantData.name}
                    onChange={(e) => setTenantData({ ...tenantData, name: e.target.value })}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={tenantData.timezone}
                    onValueChange={(value) => setTenantData({ ...tenantData, timezone: value })}
                  >
                    <SelectTrigger data-testid="select-timezone">
                      <Globe className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={tenantData.currency}
                    onValueChange={(value) => setTenantData({ ...tenantData, currency: value })}
                  >
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => updateTenantMutation.mutate(tenantData)}
                disabled={updateTenantMutation.isPending}
                data-testid="button-save-business"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Choose what emails you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Call Summaries</Label>
                  <p className="text-sm text-muted-foreground">Daily summary of call activity</p>
                </div>
                <Switch
                  checked={notifications.emailCalls}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailCalls: checked })
                  }
                  data-testid="switch-email-calls"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">WhatsApp Activity</Label>
                  <p className="text-sm text-muted-foreground">Notifications for new conversations</p>
                </div>
                <Switch
                  checked={notifications.emailWhatsApp}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailWhatsApp: checked })
                  }
                  data-testid="switch-email-whatsapp"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Billing Alerts</Label>
                  <p className="text-sm text-muted-foreground">Low credit and billing notifications</p>
                </div>
                <Switch
                  checked={notifications.emailBilling}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailBilling: checked })
                  }
                  data-testid="switch-email-billing"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telephony" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>SignalWire Telephony</CardTitle>
              <CardDescription>Configure phone numbers for AI voice calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {telephonyLoading ? (
                <div className="flex items-center justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : telephonyStatus?.configured ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-300 font-medium">SignalWire Connected</span>
                  </div>

                  <div className="space-y-2">
                    <Label>Available Phone Numbers</Label>
                    {telephonyStatus.phoneNumbers.length > 0 ? (
                      <div className="space-y-2">
                        {telephonyStatus.phoneNumbers.map((phone, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 rounded-md bg-muted">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <code className="font-mono text-sm">{phone}</code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No phone numbers configured in SignalWire account</p>
                    )}
                  </div>

                  <Button variant="outline" onClick={() => refetchTelephony()} data-testid="button-refresh-telephony">
                    Refresh Status
                  </Button>
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed rounded-md text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <XCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">SignalWire Not Configured</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    SignalWire credentials are required for AI voice calls. Please configure your SignalWire account.
                  </p>
                  <div className="text-left max-w-md mx-auto space-y-2">
                    <p className="text-sm">Required environment variables:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      <li>SIGNALWIRE_PROJECT_ID</li>
                      <li>SIGNALWIRE_TOKEN</li>
                      <li>SIGNALWIRE_SPACE_URL</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Phone Numbers</CardTitle>
              <CardDescription>Add and verify your phone numbers for outbound calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {pendingPhoneId ? (
                <div className="space-y-4 p-4 rounded-md bg-muted">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Enter Verification Code</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A 6-digit code was sent to your phone. Check server logs for the code (demo mode).
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter 6-digit code"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      maxLength={6}
                      data-testid="input-otp"
                    />
                    <Button
                      onClick={() => verifyOtpMutation.mutate({ phoneId: pendingPhoneId, otpCode: otpInput })}
                      disabled={otpInput.length !== 6 || verifyOtpMutation.isPending}
                      data-testid="button-verify-otp"
                    >
                      {verifyOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                    <Button variant="outline" onClick={() => { setPendingPhoneId(null); setOtpInput(""); }} data-testid="button-cancel-verify">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input
                      placeholder="+1234567890"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      data-testid="input-new-phone"
                    />
                    <Input
                      placeholder="Label (optional)"
                      value={newPhoneLabel}
                      onChange={(e) => setNewPhoneLabel(e.target.value)}
                      data-testid="input-phone-label"
                    />
                    <Button
                      onClick={() => startVerificationMutation.mutate({ phoneNumber: newPhoneNumber, label: newPhoneLabel || undefined })}
                      disabled={!newPhoneNumber || startVerificationMutation.isPending}
                      data-testid="button-add-phone"
                    >
                      {startVerificationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Number
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter your mobile number with country code to receive a verification call/SMS.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Verified Numbers</Label>
                {phonesLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : tenantPhones.filter(p => p.status === "VERIFIED").length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-md">
                    No verified phone numbers yet. Add one above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tenantPhones.filter(p => p.status === "VERIFIED").map((phone) => (
                      <div key={phone.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted" data-testid={`phone-row-${phone.id}`}>
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <code className="font-mono text-sm">{phone.phoneNumber}</code>
                            {phone.label && <span className="ml-2 text-sm text-muted-foreground">({phone.label})</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {phone.isDefaultOutbound && (
                              <Badge variant="secondary" className="text-xs">
                                <PhoneOutgoing className="h-3 w-3 mr-1" />
                                Outbound
                              </Badge>
                            )}
                            {phone.isDefaultInbound && (
                              <Badge variant="secondary" className="text-xs">
                                <PhoneIncoming className="h-3 w-3 mr-1" />
                                Inbound
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!phone.isDefaultOutbound && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDefaultMutation.mutate({ id: phone.id, type: "outbound" })}
                              disabled={setDefaultMutation.isPending}
                              title="Set as default outbound"
                              data-testid={`button-set-outbound-${phone.id}`}
                            >
                              <PhoneOutgoing className="h-4 w-4" />
                            </Button>
                          )}
                          {!phone.isDefaultInbound && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDefaultMutation.mutate({ id: phone.id, type: "inbound" })}
                              disabled={setDefaultMutation.isPending}
                              title="Set as default inbound"
                              data-testid={`button-set-inbound-${phone.id}`}
                            >
                              <PhoneIncoming className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletePhoneMutation.mutate(phone.id)}
                            disabled={deletePhoneMutation.isPending}
                            data-testid={`button-delete-phone-${phone.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {tenantPhones.filter(p => p.status === "PENDING").length > 0 && (
                <div className="space-y-2">
                  <Label>Pending Verification</Label>
                  <div className="space-y-2">
                    {tenantPhones.filter(p => p.status === "PENDING").map((phone) => (
                      <div key={phone.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800" data-testid={`pending-phone-row-${phone.id}`}>
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          <code className="font-mono text-sm">{phone.phoneNumber}</code>
                          <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">Pending</Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingPhoneId(phone.id)}
                          data-testid={`button-verify-pending-${phone.id}`}
                        >
                          Enter Code
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Business Connection</CardTitle>
              <CardDescription>Connect your WhatsApp Business account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-6 border-2 border-dashed rounded-md text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Connect WhatsApp Business</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Link your WhatsApp Business account to enable AI-powered messaging
                </p>
                <Button data-testid="button-connect-whatsapp">
                  Connect WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys for integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-md bg-muted">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <p className="font-medium">Production API Key</p>
                    <p className="text-sm text-muted-foreground">Use this key in production</p>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-regenerate-key">
                    Regenerate
                  </Button>
                </div>
                <code className="block p-3 rounded-md bg-background font-mono text-sm break-all">
                  tc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </code>
              </div>

              <div className="p-4 rounded-md bg-muted">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div>
                    <p className="font-medium">Test API Key</p>
                    <p className="text-sm text-muted-foreground">Use this key for development</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Regenerate
                  </Button>
                </div>
                <code className="block p-3 rounded-md bg-background font-mono text-sm break-all">
                  tc_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
