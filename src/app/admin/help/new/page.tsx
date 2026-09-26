import ArticleForm from "../[id]/page";
export default function NewArticlePage() { return ArticleForm({ params: Promise.resolve({ id: "new" }) }); }
