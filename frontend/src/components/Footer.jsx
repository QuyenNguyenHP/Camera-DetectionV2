import { Fragment } from "react";

export default function Footer({ items }) {
  return (
    <footer>
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && <i />}
          <span>{item}</span>
        </Fragment>
      ))}
    </footer>
  );
}
