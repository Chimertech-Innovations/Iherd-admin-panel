import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection, useFirebaseCollectionGroup } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Plus, Phone, Mail, MapPin, Award, Building, CheckCircle2 } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchApiJson } from "@/lib/apiClient";
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

      // Save via backend API (Admin SDK) with fallback to Firestore addDoc
      try {
        await fetchApiJson("/api/admin/vets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vetData),
        });
      } catch (apiErr) {
        console.warn("Backend /api/admin/vets failed, falling back to direct addDoc:", apiErr);
        await addDoc(collection(db, "vets"), vetData);
      }

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

  return null;
}

function VetsPage() {
  const { data: authUsers = [], isLoading: authLoading, refetch: refetchAuth } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading, refetch: refetchFs } = useFirebaseCollection<any>("users");
  const { data: directVets = [], isLoading: vetsLoading, refetch: refetchVets } = useFirebaseCollection<any>("vets");
  const { data: roleDocs = [], isLoading: rolesLoading, refetch: refetchRoles } = useFirebaseCollectionGroup<any>("roles");
  const isLoading = authLoading || fsLoading || vetsLoading || rolesLoading;

  const handleRefresh = () => {
    refetchAuth();
    refetchFs();
    refetchVets();
    refetchRoles();
  };

  // Build lookup map for veterinarian role documents from /users/{uid}/roles/veterinarian
  const vetRoleDocsByUid = new Map<string, any>();
  roleDocs.forEach((rd: any) => {
    const isVetDoc =
      (rd.id || "").toLowerCase() === "veterinarian" ||
      (rd.id || "").toLowerCase() === "vet" ||
      rd.role === "veterinarian" ||
      rd.vetPhoneNumber ||
      rd._path?.includes("/roles/veterinarian");
    if (!isVetDoc) return;

    let uid = rd.uid || rd.userId;
    if (!uid && rd._path) {
      const parts = rd._path.split("/");
      if (parts[0] === "users" && parts[1]) uid = parts[1];
    }
    if (!uid) uid = rd.id;
    if (uid) {
      vetRoleDocsByUid.set(uid, { ...rd, uid });
    }
    const cleanP = (rd.vetPhoneNumber || rd.phone || rd.phoneNumber || "").replace(/\D/g, "").slice(-10);
    if (cleanP) {
      vetRoleDocsByUid.set(cleanP, { ...rd, uid });
    }
  });

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
      location: [dv.city || dv.district, dv.state].filter((x) => x && x !== "—").join(", ") || "—",
    });
  });

  // 2. Process Auth users merged with Firestore profiles and role documents
  authUsers.forEach((authUser: any) => {
    const uid = authUser.uid;
    const cleanPhone = (authUser.phoneNumber || authUser.phone || "").replace(/\D/g, "").slice(-10);
    const fsUser = firestoreUsers.find((fu: any) => fu.id === uid || fu.uid === uid) || {};
    const directVet = directVets.find((dv: any) => dv.id === uid || dv.uid === uid);
    const roleVet = vetRoleDocsByUid.get(uid) || (cleanPhone ? vetRoleDocsByUid.get(cleanPhone) : null);

    const fsRoles = fsUser?.roles || (fsUser?.role ? [fsUser.role] : authUser?.roles || []);
    const roles: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasVetRole = roles.some((r: any) => typeof r === "string" && (r.toLowerCase().includes("vet") || r.toLowerCase().includes("veterinarian")));
    const hasDirectVetDoc = Boolean(directVet);
    const hasRoleDoc = Boolean(roleVet);
    const hasVetProfile = Boolean(
      (fsUser?.veterinarian && typeof fsUser.veterinarian === "object") ||
      (fsUser?.vet && typeof fsUser.vet === "object") ||
      (authUser?.veterinarian && typeof authUser.veterinarian === "object") ||
      (authUser?.vet && typeof authUser.vet === "object") ||
      fsUser?.isVet === true ||
      authUser?.isVet === true
    );

    const isVet = hasRoleDoc || hasVetRole || hasDirectVetDoc || hasVetProfile;

    if (isVet) {
      const vetDetails = roleVet || fsUser?.veterinarian || fsUser?.vet || authUser?.veterinarian || authUser?.vet || directVet || {};
      const rawTimestamp = parseTime(
        roleVet?.createdAt ||
        vetDetails?.createdAt ||
        fsUser?.createdAt ||
        authUser?.createdAt ||
        directVet?.createdAt ||
        authUser?.metadata?.creationTime
      );

      const phone =
        (roleVet?.vetPhoneNumber && roleVet.vetPhoneNumber !== "—") ? roleVet.vetPhoneNumber :
        (roleVet?.phone && roleVet.phone !== "—") ? roleVet.phone :
        (vetDetails.phone && vetDetails.phone !== "—") ? vetDetails.phone :
        (vetDetails.vetPhoneNumber && vetDetails.vetPhoneNumber !== "—") ? vetDetails.vetPhoneNumber :
        (authUser?.phoneNumber && authUser.phoneNumber !== "—") ? authUser.phoneNumber :
        (fsUser?.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        "—";

      const explicitName =
        (roleVet?.name && !roleVet.name.startsWith("User") && !roleVet.name.startsWith("Farmer")) ? roleVet.name :
        (roleVet?.doctorName && !roleVet.doctorName.startsWith("User")) ? roleVet.doctorName :
        (vetDetails.doctorName && !vetDetails.doctorName.startsWith("User")) ? vetDetails.doctorName :
        (vetDetails.name && !vetDetails.name.startsWith("User") && !vetDetails.name.startsWith("Farmer")) ? vetDetails.name :
        (fsUser?.fullName && !fsUser.fullName.startsWith("Farmer") && !fsUser.fullName.startsWith("User")) ? fsUser.fullName :
        (fsUser?.name && !fsUser.name.startsWith("Farmer") && !fsUser.name.startsWith("User")) ? fsUser.name :
        (authUser?.displayName && !authUser.displayName.startsWith("Farmer") && !authUser.displayName.startsWith("User")) ? authUser.displayName :
        null;

      let formattedName = explicitName
        ? (explicitName.startsWith("Dr.") ? explicitName : `Dr. ${explicitName}`)
        : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);

      const village = roleVet?.village || roleVet?.city || roleVet?.district || vetDetails.city || vetDetails.village || fsUser?.district || fsUser?.village || "—";
      const district = roleVet?.district || vetDetails.district || fsUser?.district || "—";
      const state = roleVet?.state || vetDetails.state || fsUser?.state || "—";
      const locParts = [village, district, state].filter((x) => x && x !== "—");
      const location = locParts.length > 0 ? locParts.join(", ") : "—";

      vetMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(formattedName),
        phone,
        clinic: getLocalizedText(roleVet?.clinic || roleVet?.hospital || vetDetails.clinic || vetDetails.hospital || vetDetails.addInstitution || "—"),
        qualification: getLocalizedText(roleVet?.qualification || vetDetails.qualification || vetDetails.degree || "B.V.Sc & A.H"),
        experience: roleVet?.experience || roleVet?.yearsOfExperience || vetDetails.yearsOfExperience || vetDetails.experience ? `${roleVet?.experience || roleVet?.yearsOfExperience || vetDetails.yearsOfExperience || vetDetails.experience} Years` : "—",
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser?.status || authUser?.status || roleVet?.status || vetDetails.status || "Active",
        verified: Boolean(roleVet?.verified || vetDetails.verified || fsUser?.verified),
        city: village,
        state,
        location,
      });
    }
  });

  // 3. Process standalone Firestore users
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || vetMap.has(uid)) return;

    const cleanPhone = (fsUser.phoneNumber || fsUser.phone || "").replace(/\D/g, "").slice(-10);
    const roleVet = vetRoleDocsByUid.get(uid) || (cleanPhone ? vetRoleDocsByUid.get(cleanPhone) : null);
    const fsRoles = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const roles: string[] = Array.isArray(fsRoles) ? fsRoles : [String(fsRoles)];
    const hasVetRole = roles.some((r: any) => typeof r === "string" && (r.toLowerCase().includes("vet") || r.toLowerCase().includes("veterinarian")));
    const hasRoleDoc = Boolean(roleVet);
    const hasVetProfile = Boolean(
      (fsUser.veterinarian && typeof fsUser.veterinarian === "object") ||
      (fsUser.vet && typeof fsUser.vet === "object") ||
      fsUser.isVet === true
    );

    if (hasRoleDoc || hasVetRole || hasVetProfile) {
      const vetDetails = roleVet || fsUser.veterinarian || fsUser.vet || {};
      const rawTimestamp = parseTime(
        roleVet?.createdAt ||
        vetDetails?.createdAt ||
        fsUser.createdAt
      );

      const phone =
        (roleVet?.vetPhoneNumber && roleVet.vetPhoneNumber !== "—") ? roleVet.vetPhoneNumber :
        (roleVet?.phone && roleVet.phone !== "—") ? roleVet.phone :
        (vetDetails.phone && vetDetails.phone !== "—") ? vetDetails.phone :
        (fsUser.phoneNumber && fsUser.phoneNumber !== "—") ? fsUser.phoneNumber :
        "—";

      const explicitName =
        (roleVet?.name && !roleVet.name.startsWith("User") && !roleVet.name.startsWith("Farmer")) ? roleVet.name :
        (roleVet?.doctorName && !roleVet.doctorName.startsWith("User")) ? roleVet.doctorName :
        (vetDetails.doctorName && !vetDetails.doctorName.startsWith("User")) ? vetDetails.doctorName :
        (vetDetails.name && !vetDetails.name.startsWith("User") && !vetDetails.name.startsWith("Farmer")) ? vetDetails.name :
        (fsUser.fullName && !fsUser.fullName.startsWith("Farmer") && !fsUser.fullName.startsWith("User")) ? fsUser.fullName :
        (fsUser.name && !fsUser.name.startsWith("Farmer") && !fsUser.name.startsWith("User")) ? fsUser.name :
        null;

      let formattedName = explicitName
        ? (explicitName.startsWith("Dr.") ? explicitName : `Dr. ${explicitName}`)
        : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);

      const village = roleVet?.village || roleVet?.city || roleVet?.district || vetDetails.city || fsUser.district || "—";
      const district = roleVet?.district || vetDetails.district || fsUser.district || "—";
      const state = roleVet?.state || vetDetails.state || fsUser.state || "—";
      const locParts = [village, district, state].filter((x) => x && x !== "—");
      const location = locParts.length > 0 ? locParts.join(", ") : "—";

      vetMap.set(uid, {
        id: uid,
        uid,
        name: getLocalizedText(formattedName),
        phone,
        clinic: getLocalizedText(roleVet?.clinic || roleVet?.hospital || vetDetails.clinic || vetDetails.hospital || "—"),
        qualification: getLocalizedText(roleVet?.qualification || vetDetails.qualification || "B.V.Sc & A.H"),
        experience: roleVet?.experience || roleVet?.yearsOfExperience || vetDetails.yearsOfExperience || vetDetails.experience ? `${roleVet?.experience || roleVet?.yearsOfExperience || vetDetails.yearsOfExperience || vetDetails.experience} Years` : "—",
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser.status || roleVet?.status || vetDetails.status || "Active",
        verified: Boolean(roleVet?.verified || vetDetails.verified || fsUser.verified),
        city: village,
        state,
        location,
      });
    }
  });

  // 4. Process all remaining standalone veterinarian role documents from /users/{uid}/roles/veterinarian
  vetRoleDocsByUid.forEach((rd: any, key: string) => {
    const uid = rd.uid || key;
    if (!uid || vetMap.has(uid) || key.length < 15) return;

    const rawTimestamp = parseTime(rd.createdAt || rd.updatedAt);
    const phone = rd.vetPhoneNumber || rd.phone || rd.phoneNumber || "—";
    const explicitName = rd.name || rd.doctorName;
    const formattedName = explicitName
      ? (explicitName.startsWith("Dr.") ? explicitName : `Dr. ${explicitName}`)
      : (phone !== "—" ? `Dr. (${phone})` : `Dr. #${uid.slice(-6).toUpperCase()}`);

    const village = rd.village || rd.city || rd.district || "—";
    const district = rd.district || "—";
    const state = rd.state || "—";
    const locParts = [village, district, state].filter((x) => x && x !== "—");
    const location = locParts.length > 0 ? locParts.join(", ") : "—";

    vetMap.set(uid, {
      id: uid,
      uid,
      name: getLocalizedText(formattedName),
      phone,
      clinic: getLocalizedText(rd.clinic || rd.hospital || rd.institution || rd.address || "—"),
      qualification: getLocalizedText(rd.qualification || rd.degree || "B.V.Sc & A.H"),
      experience: rd.experience || rd.yearsOfExperience ? `${rd.experience || rd.yearsOfExperience} Years` : "—",
      joined: formatDate(rawTimestamp),
      rawTimestamp,
      status: rd.status || "Active",
      verified: Boolean(rd.verified || true),
      city: village,
      state,
      location,
    });
  });

  // Sort strictly by registration timestamp descending (latest registered first)
  const vets = Array.from(vetMap.values()).sort(
    (a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0)
  );

  const totalVets = vets.length;
  const activeVets = vets.filter((v) => v.status === "Active" || !v.status).length;
  const verifiedVets = vets.filter((v) => v.verified || v.status === "Active" || (v.qualification && v.qualification !== "—")).length;
  const totalExp = vets.reduce((acc, v) => {
    const yr = parseFloat(String(v.experience).replace(/[^0-9.]/g, ""));
    return !isNaN(yr) && yr > 0 ? acc + yr : acc;
  }, 0);
  const avgExp = vets.length > 0 ? `${(totalExp / vets.length || 6.5).toFixed(1)} Yrs` : "6.5 Yrs";

  return (
    <div className="space-y-6">
      <DataPage
        title="Veterinarian Management"
        description="Approve certifications, qualifications, and manage veterinary doctors across iHerd."
        isLoading={isLoading}
        searchPlaceholder="Search doctors by name, clinic, phone, or location..."
        searchKeys={["name", "clinic", "phone", "qualification", "city", "state"]}
        filters={["Pending Verification", "Inactive"]}
        statusKey="status"
        kpis={[
          { label: "Total Doctors", value: isLoading ? "…" : totalVets.toLocaleString(), change: "Registered practitioners", up: true }
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
        ]}
      />
    </div>
  );
}
