import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CUSTOMER_SERVICE_CATEGORIES,
  CUSTOMER_SERVICE_CATEGORY_LABELS,
  type CustomerServiceCategory,
} from "../../../shared/constants/customers";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import { customersService } from "../../services/customers.service";
import { Button, Input, Modal, Select } from "../ui";

export function CustomerServiceForm({
  open,
  onClose,
  customerId,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] =
    useState<CustomerServiceCategory | "">("");
  const [totalCost, setTotalCost] = useState("");
  const [profit, setProfit] = useState("");
  const [serviceDeliveredOn, setServiceDeliveredOn] = useState("");
  const [renewalOn, setRenewalOn] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setServiceName("");
    setServiceCategory("");
    setTotalCost("");
    setProfit("");
    setServiceDeliveredOn("");
    setRenewalOn("");
    setFormError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      customersService.addService(customerId, {
        serviceName: serviceName.trim(),
        serviceCategory: serviceCategory || undefined,
        totalCost: totalCost ? Number(totalCost) : undefined,
        profit: profit ? Number(profit) : undefined,
        serviceDeliveredOn: serviceDeliveredOn || undefined,
        renewalOn: renewalOn || undefined,
      }),
    onSuccess: async () => {
      toast({
        title: "Service added",
        description: "The service has been added to this customer's history.",
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not add this service. Please try again.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serviceName.trim()) {
      setFormError("Enter a service name.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  };

  const handleClose = () => {
    if (!mutation.isPending) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add service"
      description="Record another service for this customer."
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-service-form"
            isLoading={mutation.isPending}
          >
            Add service
          </Button>
        </>
      }
    >
      <form
        id="customer-service-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {formError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        ) : null}
        <Input
          label="Service name"
          value={serviceName}
          onChange={(event) => setServiceName(event.target.value)}
          required
          maxLength={160}
          placeholder="e.g. Website maintenance"
        />
        <Select
          label="Service category"
          value={serviceCategory}
          onChange={(event) =>
            setServiceCategory(
              event.target.value as CustomerServiceCategory | "",
            )
          }
        >
          <option value="">Select category</option>
          {CUSTOMER_SERVICE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CUSTOMER_SERVICE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Total cost (₹)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={totalCost}
            onChange={(event) => setTotalCost(event.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Profit (₹)"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={profit}
            onChange={(event) => setProfit(event.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Service delivered on"
            type="date"
            value={serviceDeliveredOn}
            onChange={(event) => setServiceDeliveredOn(event.target.value)}
          />
          <Input
            label="Renewal date"
            type="date"
            value={renewalOn}
            onChange={(event) => setRenewalOn(event.target.value)}
            hint="Leave blank if this service does not renew."
          />
        </div>
      </form>
    </Modal>
  );
}
