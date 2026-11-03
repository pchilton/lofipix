import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { expect, screen, userEvent } from "storybook/test";

import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  title: "ShadCN/Toaster",
  component: Toaster,
  tags: ["autodocs"],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Toaster position="top-center" />,
};

export const Success: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Toaster position="top-center" />
      <Button
        onClick={() =>
          toast.success("Album saved", {
            description: "Sync starts when the device reconnects.",
          })
        }
      >
        Show toast
      </Button>
    </div>
  ),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Show toast" }));
    await expect(await screen.findByText("Album saved")).toBeInTheDocument();
  },
};
