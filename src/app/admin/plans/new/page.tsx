import PlanForm from "../[id]/page";
export default function NewPlanPage() {
  return PlanForm({ params: Promise.resolve({ id: "new" }) });
}
