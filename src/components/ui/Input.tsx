import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`input ${error ? 'border-sentiment-bearish focus:ring-sentiment-bearish' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-sentiment-bearish">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
