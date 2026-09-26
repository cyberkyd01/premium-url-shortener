import PageForm from "../[id]/page";
export default function NewPage() { return PageForm({ params: Promise.resolve({ id: "new" }) }); }
