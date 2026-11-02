import type { ReactNode } from 'react';

export type TimelineNode = {
    id: string;
    title: string;
    subtitle?: string;
    active?: boolean;
    children?: TimelineNode[];
};

type Props = {
    nodes: TimelineNode[];
    depth?: number;
};

function TimelineBranch({ nodes, depth = 0 }: Props) {
    return (
        <ul className={`timeline timeline--d${depth}`}>
            {nodes.map((n) => (
                <li
                    key={n.id}
                    className={`timeline__item${n.active ? ' timeline__item--active' : ''}`}
                >
                    <div className="timeline__dot" aria-hidden="true" />
                    <div className="timeline__body">
                        <div className="timeline__title">{n.title}</div>
                        {n.subtitle ? (
                            <div className="timeline__subtitle mono">{n.subtitle}</div>
                        ) : null}
                        {n.children?.length ? (
                            <TimelineBranch nodes={n.children} depth={depth + 1} />
                        ) : null}
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function Timeline(props: Props) {
    return <TimelineBranch {...props} />;
}

export function TimelineEmpty({ children }: { children: ReactNode }) {
    return <p className="timeline-empty">{children}</p>;
}
