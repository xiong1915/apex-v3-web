import type { ReactNode } from 'react';
export function PageHeading({ category, title, description, actions, meta }: { category: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
 return <header className="page-heading"><div className="page-heading-top"><span className="eyebrow">{category}</span>{actions}</div><h1>{title}</h1>{description&&<p>{description}</p>}{meta&&<div className="page-heading-meta">{meta}</div>}</header>;
}
