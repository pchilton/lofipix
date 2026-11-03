import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "ShadCN/Label",
  component: Label,
  tags: ["autodocs"],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="plate">Vehicle plate</Label>
      <Input id="plate" placeholder="AB12 CDE" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("label")).toHaveAttribute("for", "plate");
  },
};
