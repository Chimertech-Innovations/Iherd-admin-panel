import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/farmers/$farmerId")({
  component: FarmerRedirect,
});

function FarmerRedirect() {
  const { farmerId } = Route.useParams();
  return <Navigate to="/users/$userId" params={{ userId: farmerId }} replace />;
}
