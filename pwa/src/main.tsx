import { render } from "solid-js/web";
import { RouterProvider } from "@tanstack/solid-router";

import { router } from "./router";
import "./index.css";

const root = document.getElementById("root");

render(() => <RouterProvider router={router} />, root!);
