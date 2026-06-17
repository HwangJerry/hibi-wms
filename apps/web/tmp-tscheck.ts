import type { ButtonHTMLAttributes } from "react";

type B = ButtonHTMLAttributes<HTMLButtonElement>;
const x: B = { className: "a", onClick: ()=>{} };
const y: B = {};
