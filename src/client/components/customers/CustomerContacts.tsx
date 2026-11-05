import {
  Mail,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import type { CustomerContactDto } from "../../../shared/types/customers";
import { Button, Badge, EmptyState } from "../ui";

export function CustomerContacts({
  contacts,
  canManage,
  onAdd,
  onEdit,
  onRemove,
}: {
  contacts: CustomerContactDto[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (contact: CustomerContactDto) => void;
  onRemove: (contact: CustomerContactDto) => void;
}) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
        title="No contacts yet"
        description="Add the people the team should contact about this customer."
        action={
          canManage ? (
            <Button
              size="sm"
              onClick={onAdd}
              leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Add contact
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="rounded-lg border border-slate-200 p-3.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {contact.fullName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {contact.fullName}
                  </p>
                  {contact.isPrimary ? (
                    <Badge variant="brand">
                      <Star className="h-2.5 w-2.5" aria-hidden="true" />
                      Primary
                    </Badge>
                  ) : null}
                </div>
                {contact.jobTitle ? (
                  <p className="text-xs text-slate-500">{contact.jobTitle}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 hover:text-brand-700"
                    >
                      <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
                      {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-1 break-all hover:text-brand-700"
                    >
                      <Mail className="h-3 w-3 text-slate-400" aria-hidden="true" />
                      {contact.email}
                    </a>
                  ) : null}
                </div>
                {contact.notes ? (
                  <p className="mt-1.5 text-xs text-slate-500">{contact.notes}</p>
                ) : null}
              </div>
            </div>
            {canManage ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(contact)}
                  aria-label={`Edit ${contact.fullName}`}
                  leftIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(contact)}
                  aria-label={`Remove ${contact.fullName}`}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
