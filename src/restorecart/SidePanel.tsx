import { useRef, type ReactNode } from "react";
import { Dialog, IconButton, Flex } from "@radix-ui/themes";
import { X } from "lucide-react";
import { PaymentsUi } from "./PaymentsUi";
export function SidePanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <PaymentsUi>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
      >
        <Dialog.Content
          className="rc rc-side-panel"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          <Flex
            justify="between"
            align="center"
            gap="3"
            className="rc-side-panel-heading"
          >
            <Dialog.Title>{title}</Dialog.Title>
            <IconButton
              type="button"
              variant="ghost"
              aria-label={`Close ${title}`}
              onClick={onClose}
            >
              <X size={20} />
            </IconButton>
          </Flex>
          <Dialog.Description size="1" color="gray">
            {title === "Review product"
              ? "Review details and confirm stock before publishing."
              : title === "Assistant"
                ? "Suggestions need your approval."
                : "Order status, payment evidence and fulfillment."}
          </Dialog.Description>
          <div className="rc-side-panel-body">{children}</div>
        </Dialog.Content>
      </Dialog.Root>
    </PaymentsUi>
  );
}
