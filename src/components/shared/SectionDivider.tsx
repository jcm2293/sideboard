'use client';

interface SectionDividerProps {
  symbol?: string;
}

export default function SectionDivider({ symbol = '⚜' }: SectionDividerProps) {
  return <div className="divider-ornament">{symbol}</div>;
}
