import type { Meta, StoryObj } from "@storybook/react-vite";

import { Separator } from "./separator";

const meta = {
  title: "ShadCN/Separator",
  component: Separator,
  tags: ["autodocs"],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-full max-w-sm">
      <div className="text-sm font-medium">Album details</div>
      <div className="text-muted-foreground text-sm">8 photos</div>
      <Separator className="my-4" />
      <div className="text-muted-foreground text-sm">Notes</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-4">
      <span className="text-sm">Photos</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Notes</span>
    </div>
  ),
};
