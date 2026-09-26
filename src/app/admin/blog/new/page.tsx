import PostForm from "../[id]/page";
export default function NewPostPage() { return PostForm({ params: Promise.resolve({ id: "new" }) }); }
