import { type Ref } from 'react';
import Icon from '../icons/Icon';

/**
 * A real, modern glassmorphic search input: a clean inline-start search icon
 * (no box around it), a full-width text field and an optional clear button.
 * Used on the Search page and anywhere a first-class search field is needed.
 */
export default function SearchField({
  value, onChange, placeholder, label, onSubmit, onClear, autoFocus = false, id, inputRef, maxLength = 200,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  onSubmit?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  maxLength?: number;
}) {
  return (
    <form
      className="cp-search-field"
      role="search"
      onSubmit={e => { e.preventDefault(); onSubmit?.(); }}
    >
      <span className="cp-search-icon" aria-hidden="true"><Icon name="search" size={20} /></span>
      <input
        ref={inputRef}
        id={id}
        type="search"
        dir="auto"
        value={value}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value && onClear && (
        <button type="button" className="cp-search-clear" onClick={onClear} aria-label={label}>
          <Icon name="close" size={16} />
        </button>
      )}
    </form>
  );
}
