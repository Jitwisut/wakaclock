interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function Toggle({ checked, disabled, label, onChange }: ToggleProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      data-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="toggle-knob" />
    </button>
  );
}
