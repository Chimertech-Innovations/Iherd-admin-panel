import { Phone, MessageSquare, Mail, MapPin, Calendar, ShieldCheck, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";

type Props = {
  name: string;
  id: string;
  subtitle?: string;
  subtitleIcon?: any;
  avatarUrl?: string;
  initials: string;
  status: string;
  verified: boolean;
  phone: string;
  email: string;
  joined: string;
  location: string;
};

function MetaItem({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm font-semibold truncate ${valueClass ?? ""}`}>{value}</div>
      </div>
    </div>
  );
}

export function ProfileHero({
  name, id, subtitle, subtitleIcon: SubIcon, avatarUrl, initials,
  status, verified, phone, email, joined, location,
}: Props) {
  return (
    <Card className="p-6 rounded-3xl shadow-sm border-border/60">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-6 items-stretch">
        {/* Left: identity */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:border-r lg:border-border/60 lg:pr-6">
          <div className="flex flex-col items-center lg:flex-row lg:items-center gap-4 w-full">
            <Avatar className="h-20 w-20 ring-4 ring-primary/15 shadow-md shrink-0">
              <AvatarImage src={avatarUrl ?? ""} alt={name} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{name}</h2>
              {subtitle && (
                <div className="text-sm font-medium text-primary mt-0.5 flex items-center gap-1.5 justify-center lg:justify-start">
                  {SubIcon && <SubIcon className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{subtitle}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">{id}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 w-full">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast(`Calling ${phone}`)}>
              <Phone className="h-4 w-4" /> Call
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast(`Messaging ${name}`)}>
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
          </div>
        </div>

        {/* Right: metadata grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {status && status.toLowerCase() !== "active" && (
            <MetaItem
              icon={ShieldCheck}
              label="Account status"
              value={status}
              valueClass="text-destructive font-semibold"
            />
          )}
          <MetaItem
            icon={BadgeCheck}
            label="Verification"
            value={verified ? "Verified" : "Pending verification"}
            valueClass={verified ? "text-success" : "text-warning-foreground"}
          />
          <MetaItem icon={Phone} label="Phone" value={phone} />
          <MetaItem icon={Mail} label="Email" value={email} />
          <MetaItem icon={Calendar} label="Joined on" value={joined} />
          <MetaItem icon={MapPin} label="Location" value={location} />
        </div>
      </div>

      {/* Status pills under hero */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            verified
              ? "bg-success/15 text-success border-success/20"
              : "bg-warning/15 text-warning-foreground border-warning/30"
          }`}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {verified ? "Verified account" : "Unverified account"}
        </span>
      </div>
    </Card>
  );
}
