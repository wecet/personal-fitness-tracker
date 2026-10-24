import { BodyweightPage } from './BodyweightPage.tsx';
import { LoadPage } from './LoadPage.tsx';
import { RecordsPage } from './RecordsPage.tsx';
import { ReviewPage } from './ReviewPage.tsx';

export type ProgressTab = 'records' | 'load' | 'weight' | 'year';

export const PROGRESS_TABS: { id: ProgressTab; label: string }[] = [
  { id: 'records', label: 'PBs' },
  { id: 'load', label: 'Load' },
  { id: 'weight', label: 'Weight' },
  { id: 'year', label: 'Year' },
];

/** One home for the analysis views; the tab lives in the URL (#/progress/load). */
export function ProgressPage({ tab }: { tab: ProgressTab }) {
  return (
    <>
      <nav className="tabs" aria-label="Progress views">
        {PROGRESS_TABS.map((t) => (
          <a key={t.id} href={`#/progress/${t.id}`} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {tab === 'records' && <RecordsPage />}
      {tab === 'load' && <LoadPage />}
      {tab === 'weight' && <BodyweightPage />}
      {tab === 'year' && <ReviewPage />}
    </>
  );
}
