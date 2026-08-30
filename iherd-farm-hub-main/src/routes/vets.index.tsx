import { createFileRoute, Link } from "@tanstack/react-router";
import { DataPage } from "@/components/admin/DataPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useFirebaseCollection } from "../hooks/useFirebaseData";
import { getLocalizedText } from "@/lib/utils";

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
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function VetsPage() {
  const { data: authUsers = [], isLoading: authLoading } = useAdminUsers();
  const { data: firestoreUsers = [], isLoading: fsLoading } = useFirebaseCollection<any>("users");
  const { data: directVets = [], isLoading: vetsLoading } = useFirebaseCollection<any>("vets");
  const isLoading = authLoading || fsLoading || vetsLoading;

  const vetMap = new Map<string, any>();

  // 1. Process Auth users merged with Firestore profiles
  authUsers.forEach((authUser: any) => {
    const fsUser = firestoreUsers.find((fu: any) => fu.id === authUser.uid || fu.uid === authUser.uid);
    const directVet = directVets.find((dv: any) => dv.id === authUser.uid || dv.uid === authUser.uid);

    const roles: string[] = fsUser?.roles || (fsUser?.role ? [fsUser.role] : authUser?.roles || []);
    const isVet =
      roles.some((r: any) => typeof r === "string" && (r.toLowerCase().includes("vet") || r.toLowerCase().includes("veterinarian"))) ||
      Boolean(fsUser && (fsUser.veterinarian || fsUser.vet || fsUser.isVet)) ||
      Boolean(authUser && (authUser.veterinarian || authUser.vet)) ||
      Boolean(directVet);

    if (isVet) {
      const vetDetails = fsUser?.veterinarian || fsUser?.vet || authUser?.veterinarian || authUser?.vet || directVet || {};
      const uid = authUser.uid;
      const rawTimestamp = parseTime(
        fsUser?.createdAt ||
        vetDetails?.createdAt ||
        authUser?.createdAt ||
        directVet?.createdAt ||
        authUser?.metadata?.creationTime
      );

      const name = vetDetails.name || fsUser?.name || fsUser?.displayName || authUser?.displayName || "Unknown Vet";

      vetMap.set(uid, {
        id: uid,
        name: getLocalizedText(name),
        clinic: getLocalizedText(vetDetails.clinic || vetDetails.hospital || "—"),
        qualification: getLocalizedText(vetDetails.qualification || "—"),
        experience: vetDetails.experience ? `${vetDetails.experience} Years` : "—",
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser?.status || authUser?.status || vetDetails.status || "Active",
        verified: vetDetails.verified || false,
      });
    }
  });

  // 2. Process standalone Firestore users
  firestoreUsers.forEach((fsUser: any) => {
    const uid = fsUser.id || fsUser.uid;
    if (!uid || vetMap.has(uid)) return;

    const roles: string[] = fsUser.roles || (fsUser.role ? [fsUser.role] : []);
    const isVet =
      roles.some((r: any) => typeof r === "string" && (r.toLowerCase().includes("vet") || r.toLowerCase().includes("veterinarian"))) ||
      Boolean(fsUser.veterinarian || fsUser.vet || fsUser.isVet);

    if (isVet) {
      const directVet = directVets.find((dv: any) => dv.id === uid || dv.uid === uid);
      const vetDetails = fsUser.veterinarian || fsUser.vet || directVet || {};
      const rawTimestamp = parseTime(
        fsUser.createdAt ||
        vetDetails?.createdAt ||
        directVet?.createdAt
      );

      const name = vetDetails.name || fsUser.name || fsUser.displayName || "Unknown Vet";

      vetMap.set(uid, {
        id: uid,
        name: getLocalizedText(name),
        clinic: getLocalizedText(vetDetails.clinic || vetDetails.hospital || "—"),
        qualification: getLocalizedText(vetDetails.qualification || "—"),
        experience: vetDetails.experience ? `${vetDetails.experience} Years` : "—",
        joined: formatDate(rawTimestamp),
        rawTimestamp,
        status: fsUser.status || vetDetails.status || "Active",
        verified: vetDetails.verified || false,
      });
    }
  });

  // 3. Process direct vets collection
  directVets.forEach((dv: any) => {
    const id = dv.id || dv.uid;
    if (!id || vetMap.has(id)) return;

    const rawTimestamp = parseTime(dv.createdAt);

    vetMap.set(id, {
      id: id,
      name: getLocalizedText(dv.name || "Unknown Vet"),
      clinic: getLocalizedText(dv.clinic || dv.hospital || "—"),
      qualification: getLocalizedText(dv.qualification || "—"),
      experience: dv.experience ? `${dv.experience} Years` : "—",
      joined: formatDate(rawTimestamp),
      rawTimestamp,
      status: dv.status || "Active",
      verified: dv.verified || false,
    });
  });

  // Sort strictly by registration / filled timestamp descending (latest first)
  const vets = Array.from(vetMap.values()).sort(
    (a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0)
  );

  const totalVets = vets.length;
  const activeVets = vets.filter((v) => v.status === "Active" || !v.status).length;
  const pendingVets = vets.filter((v) => v.status === "Pending" || v.status === "In Review").length;

  return (
    <DataPage
      title="Veterinarian management"
      description="Approve certifications, qualifications, and manage veterinary doctors on iHerd."
      primaryAction="Register vet"
      isLoading={isLoading}
      filters={["Active", "Pending", "Suspended"]}
      rowHref={(r) => `/users/${r.id}`}
      kpis={[
        { label: "Total Veterinarians", value: totalVets.toLocaleString() },
        { label: "Active Doctors", value: activeVets.toLocaleString() },
        { label: "Pending Verification", value: pendingVets.toLocaleString() },
        { label: "Joined this month", value: "0" },
      ]}
      data={vets}
      columns={[
        {
          key: "name",
          label: "Veterinarian",
          render: (r) => (
            <Link
              to="/users/$userId"
              params={{ userId: r.id }}
              className="flex items-center gap-3 min-w-0 group"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                DR
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate group-hover:text-primary transition-colors">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.id}</div>
              </div>
            </Link>
          ),
        },
        { key: "clinic", label: "Clinic / Hospital" },
        { key: "qualification", label: "Qualification" },
        { key: "experience", label: "Experience" },
        { key: "joined", label: "Joined" },
        { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
