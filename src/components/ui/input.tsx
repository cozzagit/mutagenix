import { forwardRef, useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = "", id: idProp, ...rest }, ref) {
    const generatedId = useId();
    const id = idProp ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-medium tracking-wide text-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={[
            "focus-ring h-11 w-full rounded-xl border bg-surface-2 px-3.5 text-base text-foreground placeholder:text-muted/50 transition-colors duration-150",
            error
              ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_#ff3d3d22]"
              : "border-border focus:border-primary focus:shadow-[0_0_0_3px_#3d5afe22]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }
);
