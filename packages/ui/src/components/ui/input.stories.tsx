import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Input } from "./input";

const meta = {
  title: "ShadCN/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "Vehicle plate",
    "aria-label": "Vehicle plate",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Vehicle plate" });
    await userEvent.type(input, "AB12 CDE");
    await expect(input).toHaveValue("AB12 CDE");
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "not a plate",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "AB12 CDE",
  },
};
