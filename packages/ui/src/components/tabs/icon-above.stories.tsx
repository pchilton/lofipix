import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expect, userEvent, within } from "storybook/test";
import TabsIconAbove from "./icon-above";

const meta = {
  title: "TarkUI/Tabs/Icon Above",
  component: TabsIconAbove,
  tags: ["autodocs"],
} satisfies Meta<typeof TabsIconAbove>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SwitchesTabs: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Access courses and educational materials."),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Community" }));
    await expect(
      canvas.getByText("Connect with peers and join discussions."),
    ).toBeVisible();
  },
};
