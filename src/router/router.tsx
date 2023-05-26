import { createBrowserRouter } from "react-router-dom";
import * as React from "react";
import { Main, Login } from "../pages";

const router = createBrowserRouter([
    {
        path: "/*",
        element: <Main />,
    },
    {
        path: "login",
        element: <Login />,
    },
]);

export default router;
