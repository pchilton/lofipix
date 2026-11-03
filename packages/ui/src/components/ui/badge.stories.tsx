import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./badge";

const meta = {
  title: "ShadCN/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Queued",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Queued</Badge>
      <Badge variant="secondary">Device only</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="outline">Synced</Badge>
    </div>
  ),
};
