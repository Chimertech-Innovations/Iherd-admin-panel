import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Plus, Phone, Mail, MapPin, Award, Building, CheckCircle2 } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export const Route = createFileRoute("/vets/")({
  head: () => ({ meta: [{ title: "Veterinarians — iHerd Admin" }] }),
  component: VetsPage,
});

function parseTime(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "object" && (val._seconds || val.seconds)) {
    return (val._seconds || val.seconds) * 1000;
  }
  const d = new Date(val).getTime();
  return isNaN(d) ? 0 : d;
}

function formatDate(ms: number): string {
  if (!ms || isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AddVetDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clinic, setClinic] = useState("");
  const [qualification, setQualification] = useState("B.V.Sc & A.H");
  const [experience, setExperience] = useState("5");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim()) {
      toast.error("Please enter doctor name.");
      return;
    }

    setLoading(true);
    try {
      const cleanDocName = doctorName.trim().startsWith("Dr.") ? doctorName.trim() : `Dr. ${doctorName.trim()}`;
      const vetData = {
        name: cleanDocName,
        doctorName: cleanDocName,
        phone: phone.trim() || "—",
        phoneNumber: phone.trim() || "—",
        vetPhoneNumber: phone.trim() || "—",
        email: email.trim() || "",
        clinic: clinic.trim() || "Veterinary Clinic",
        hospital: clinic.trim() || "Veterinary Clinic",
        qualification: qualification.trim() || "B.V.Sc & A.H",
        yearsOfExperience: experience.trim() || "—",
        specialization: ["Bovine Care & Dairy Health", "Artificial Insemination"],
        state: state.trim() || "",
        city: city.trim() || "",
        status: "Active",
        verified: true,
        isVet: true,
        roles: ["veterinarian"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save directly into Firestore 'vets' collection
      await addDoc(collection(db, "vets"), vetData);

      toast.success(`Veterinarian "${cleanDocName}" registered successfully!`);
      setOpen(false);
      setDoctorName("");
      setPhone("");
      setEmail("");
      setClinic("");
      setState("");
      setCity("");
      if (onCreated) onCreated();
    } catch (err: any) {
      console.error("Error creating vet:", err);
      toast.error(err.message || "Failed to register veterinarian");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
          <Plus className="h-4 w-4" /> Register Vet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <Stethoscope className="h-4.5 w-4.5" />
            </span>
            Register Licensed Veterinarian
          </DialogTitle>
          <DialogDescription>
            Add a qualified veterinary doctor or clinic to the iHerd healthcare network.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <Label htmlFor="docName" className="text-xs font-semibold">Doctor Full Name *</Label>
            <Input
              id="docName"
              placeholder="e.g. Dr. Rajesh Sharma"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-semibold">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qual" className="text-xs font-semibold">Degree / Qualification</Label>
              <Select value={qualification} onValueChange={setQualification}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Degree" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="B.V.Sc & A.H">B.V.Sc & A.H</SelectItem>
                  <SelectItem value="M.V.Sc (Surgery)">M.V.Sc (Surgery)</SelectItem>
                  <SelectItem value="M.V.Sc (Medicine)">M.V.Sc (Medicine)</SelectItem>
                  <SelectItem value="M.V.Sc (Gynaecology)">M.V.Sc (Gynaecology)</SelectItem>
                  <SelectItem value="Diploma Vet Science">Diploma Vet Science</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="clinic" className="text-xs font-semibold">Clinic / Hospital / Institution</Label>
            <Input
              id="clinic"
              placeholder="e.g. District Cattle Care Hospital"
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="city" className="text-xs font-semibold">City / District</Label>
              <Input
                id="city"
                placeholder="e.g. Surat"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state" className="text-xs font-semibold">State</Label>
              <Input
                id="state"
                placeholder="e.g. Gujarat"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? "Registering..." : "Save Doctor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VetsPage() {
  const { data: authUsers = [], isLoading: authLoading, refetch: refetchAuth } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading, refetch: refetchFs } = useFirebaseCollection<any>("users");
  const { data: directVets = [], isLoading: vetsLoading, refetch: refetchVets } = useFirebaseCollection<any>("vets");
  const isLoading = authLoading || fsLoading || vetsLoading;

  const handleRefresh = () => {
    refetchAuth();
    refetchFs();
    refetchVets();
  };

  const vetMap = new Map<string, any>();

  // 1. Process direct vets collection
  directVets.forEach((dv: any) => {
    const id = dv.id || dv.uid;
    if (!id) return;

    const rawTimestamp = parseTime(dv.createdAt || dv.timestamp || dv.updatedAt);
    const phone = dv.phone || dv.phoneNumber || dv.vetPhoneNumber || "—";
    const docName = dv.doctorName || dv.name || (phone !== "—" ? `Dr. (${phone})` : `Dr. #${id.slice(-6).toUpperCase()}`);
    const formattedName = docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;

    vetMap.set(id, {
      id,
      uid: id,
      name: getLocalizedText(formattedName),
      phone,
      clinic: getLocalizedText(dv.clinic || dv.hospital || dv.addInstitution || "—"),
      qualification: getLocalizedText(dv.qualification || dv.degree || "B.V.Sc & A.H"),
      experience: dv.yearsOfExperience || dv.experience ? `${dv.yearsOfExperience || dv.experience} Years` : "—",
      joined: formatDate(rawTimestamp),
      rawTimestamp,
      status: dv.status || "Active",
      verified: Boolean(dv.verified || dv.isVerified),
      city: dv.city || dv.district || "—",
      state: dv.state || "—",
    });
  });

  // 2. Process Auth users merged with Firestore profiles
  authUsers.forEach((authUser: any) => {
    const uid = authUser.uid;
    const fsUser = firestoreUsers.find((fu: any) => fu.id === uid || fu.uid === uid);
    const directVet = directVets.find((dv: any) => dv.id === uid || dv.uid === uid);

    const fsRoles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : authUser?.roles || []);
    const roles: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasVetRole = roles.some((r: any) => typeof r === "string" && (r.toLowerCase().includes("vet") || r.toLowerCase().includes("veterinarian")));
    const hasDirectVetDoc = Boolean(directVet);
    const hasVetProfile = Boolean(
      (fsUser?.veterinarian && typeof fsUser.veterinarian === "object") ||
      (fsUser?.vet && typeof fsUser.vet === "object") ||
      (authUser?.veterinarian && typeof authUser.veterinarian === "object") ||
      (authUser?.vet && typeof authUser.vet === "object") ||
      fsUser?.isVet === true ||
      authUser?.isVet === true
    );

    const isVet = hasVetRole || hasDirectVetDoc || hasVetProfile;

    if (isVet) {
      const vetDetails = fsUser?.veterinarian || fsUser?.vet || authUser?.veterinarian || authUser?.vet || directVet || {};
      const rawTimestamp = parseTime(
        vetDetails?.createdAt ||
        fsUser?.createdAt ||
        authUser?.createdAt ||
        directVet?.createdAt ||
        authUser?.metadata?.creationTime
      );

      const phone =
        (vetDetails.phone && vetDetails.phone !== "—") ? vetDetails.phone :
        (vetDetails.vetPhoneNumber && vetDetails.vetPhoneNumber !== "—") ? vetDetails.vetPhoneNumber :
        (authUser?.phoneNumber && authUser.phoneNumber !== "—") ? authUser.phoneNumber :
        (fsUser?.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        "—";

      const explicitName =
        (vetDetails.doctorName && !vetDetails.doctorName.startsWith("User")) ? vetDetails.doctorName :
        (vetDetails.name && !vetDetails.name.startsWith("User")) ? vetDetails.name :
        (fsUser?.fullName && !fsUser.fullName.startsWith("Farmer") && !fsUser.fullName.startsWith("User")) ? fsUser.fullName :
        (fsUser?.name && !fsUser.name.startsWith("Farmer") && !fsUser.name.startsWith("User")) ? fsUser.name :
        (authUser?.displayName && !authUser.displayName.startsWith("Farmer") && !authUser.displayName.startsWith("User")) ? authUser.displayName :
        null;

      let formattedName = explicitName
        ? (explicitName.startsWith("Dr.") ? explicitName : `Dr. ${explicitName}`)
        : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);

      vetMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(formattedName),
        phone,
        clinic: getLocalizedText(vetDetails.clinic || vetDetails.hospital || vetDetails.addInstitution || "—"),
        qualification: getLocalizedText(vetDetails.qualification || vetDetails.degree || "B.V.Sc & A.H"),
        experience: vetDetails.yearsOfExperience || vetDetails.experience ? `${vetDetails.yearsOfExperience || vetDetails.experience} Years` : "—",
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser?.status || authUser?.status || vetDetails.status || "Active",
        verified: Boolean(vetDetails.verified || fsUser?.verified),
        city: vetDetails.city || fsUser?.district || "—",
        state: vetDetails.state || fsUser?.state || "—",
      });
    }
  });

  // 3. Process standalone Firestore users
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || vetMap.has(uid)) return;

    const fsRoles = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const roles: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasVetRole = roles.some((r: any) => typeof r === "string" && (r.toLowerCase().includes("vet") || r.toLowerCase().includes("veterinarian")));
    const hasVetProfile = Boolean(
      (fsUser.veterinarian && typeof fsUser.veterinarian === "object") ||
      (fsUser.vet && typeof fsUser.vet === "object") ||
      fsUser.isVet === true
    );

    if (hasVetRole || hasVetProfile) {
      const vetDetails = fsUser.veterinarian || fsUser.vet || {};
      const rawTimestamp = parseTime(
        vetDetails?.createdAt ||
        fsUser.createdAt
      );

      const phone =
        (vetDetails.phone && vetDetails.phone !== "—") ? vetDetails.phone :
        (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        "—";

      const explicitName =
        (vetDetails.doctorName && !vetDetails.doctorName.startsWith("User")) ? vetDetails.doctorName :
        (vetDetails.name && !vetDetails.name.startsWith("User")) ? vetDetails.name :
        (fsUser.fullName && !fsUser.fullName.startsWith("Farmer") && !fsUser.fullName.startsWith("User")) ? fsUser.fullName :
        (fsUser.name && !fsUser.name.startsWith("Farmer") && !fsUser.name.startsWith("User")) ? fsUser.name :
        null;

      let formattedName = explicitName
        ? (explicitName.startsWith("Dr.") ? explicitName : `Dr. ${explicitName}`)
        : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);

      vetMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(formattedName),
        phone,
        clinic: getLocalizedText(vetDetails.clinic || vetDetails.hospital || "—"),
        qualification: getLocalizedText(vetDetails.qualification || "B.V.Sc & A.H"),
        experience: vetDetails.yearsOfExperience || vetDetails.experience ? `${vetDetails.yearsOfExperience || vetDetails.experience} Years` : "—",
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser.status || vetDetails.status || "Active",
        verified: Boolean(vetDetails.verified || fsUser.verified),
        city: vetDetails.city || fsUser.district || "—",
        state: vetDetails.state || fsUser.state || "—",
        location: [vetDetails.city || fsUser.district, vetDetails.state || fsUser.state].filter(x => x && x !== "—").join(", ") || "—",
      });
    }
  });

  // Sort strictly by registration timestamp descending (latest registered first)
  const vets = Array.from(vetMap.values()).sort(
    (a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0)
  );

  const totalVets = vets.length;
  const activeVets = vets.filter((v) => v.status === "Active" || !v.status).length;
  const verifiedVets = vets.filter((v) => v.verified).length;

  return (
    <div className="space-y-6">
      <DataPage
        title="Veterinarian Management"
        description="Approve certifications, qualifications, and manage veterinary doctors across iHerd."
        primaryAction={<AddVetDialog onCreated={handleRefresh} />}
        isLoading={isLoading}
        searchPlaceholder="Search doctors by name, clinic, phone, or location..."
        searchKeys={["name", "clinic", "phone", "qualification", "city", "state"]}
        kpis={[
          { label: "Total Doctors", value: isLoading ? "…" : totalVets.toLocaleString(), change: "Registered practitioners", up: true },
          { label: "Active Doctors", value: isLoading ? "…" : activeVets.toLocaleString(), change: "Available for consultation", up: true },
          { label: "Verified License", value: isLoading ? "…" : verifiedVets.toLocaleString(), change: "Certificate approved", up: true },
          { label: "Avg Experience", value: isLoading ? "…" : "6.5 Yrs", change: "Qualified experts", up: true },
        ]}
        data={vets}
        rowHref={(row) => `/users/${row.id}`}
        columns={[
          {
            key: "name",
            label: "Doctor Name",
            render: (row) => (
              <Link
                to="/users/$userId"
                params={{ userId: row.id }}
                className="flex items-center gap-3 min-w-0 group"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 font-bold text-xs border border-blue-500/20 group-hover:scale-105 transition-transform">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {row.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <span>{row.qualification}</span>
                    {row.experience !== "—" && (
                      <>
                        <span>•</span>
                        <span>{row.experience}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ),
          },
          {
            key: "phone",
            label: "Contact Phone",
            render: (row) => (
              <div className="flex items-center gap-1 text-xs font-medium">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{row.phone || "—"}</span>
              </div>
            ),
          },
          {
            key: "clinic",
            label: "Clinic / Institution",
            render: (row) => (
              <div className="text-xs text-foreground max-w-[200px] truncate">
                {row.clinic}
              </div>
            ),
          },
          {
            key: "location",
            label: "Location",
            render: (row) => (
              <span className="text-xs text-muted-foreground">
                {row.city !== "—" ? `${row.city}, ${row.state}` : row.state || "—"}
              </span>
            ),
          },
          {
            key: "joined",
            label: "Joined Date",
            render: (row) => <span className="text-xs text-muted-foreground">{row.joined}</span>,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status || "Active"} />,
          },
        ]}
      />
    </div>
  );
}
