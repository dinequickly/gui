interface Props {
  label: string;
  color?: string;
}

export function FieldBadge({ label, color }: Props) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 500,
      background: color ?? '#e9e9e7',
      color: '#333',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
