import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect } from "storybook/test";
import IconCamera from "~icons/lucide/camera";
import IconCarWrench from "~icons/mdi/car-wrench";

const meta = {
  title: "Icons/Collections",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collections: Story = {
  render: () => (
    <div class="flex items-center gap-6 text-gray-800">
      <IconCamera class="size-8" />
      <IconCarWrench class="size-8" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll("svg");
    await expect(svgs).toHaveLength(2);
    await expect(svgs[0]).toHaveClass("size-8");
    await expect(svgs[1]).toHaveClass("size-8");
  },
};
