import { Search } from "lucide-react";
import { Input } from "../ui";

export function LeadSearch({
  value,
  onChange,
  placeholder = "Search by name, phone, business, email or lead number",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      aria-label="Search leads"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
    />
  );
}
