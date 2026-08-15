import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { confirm, ConfirmDialogHost } from "./ConfirmDialog";

// The e2e critical-path spec clicks through this dialog for real (it gates
// "place order"), but only the happy path — this covers the promise
// resolving both ways and the keyboard shortcuts, which nothing else does.

describe("confirm/ConfirmDialogHost", () => {
  afterEach(cleanup);

  it("resolves true when Confirm is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);

    const resultPromise = confirm("Place this order?");
    await screen.findByText("Place this order?");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await resultPromise).toBe(true);
    expect(screen.queryByText("Place this order?")).not.toBeInTheDocument();
  });

  it("resolves false when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);

    const resultPromise = confirm("Delete this address?");
    await screen.findByText("Delete this address?");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await resultPromise).toBe(false);
  });

  it("resolves false on Escape and true on Enter", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);

    const escapeResult = confirm("Remove item?");
    await screen.findByText("Remove item?");
    await user.keyboard("{Escape}");
    expect(await escapeResult).toBe(false);

    const enterResult = confirm("Remove item again?");
    await screen.findByText("Remove item again?");
    await user.keyboard("{Enter}");
    expect(await enterResult).toBe(true);
  });

  it("respects custom confirm/cancel text and the danger:false flag", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);

    const resultPromise = confirm("Set as primary?", {
      confirmText: "Yes, set it",
      cancelText: "Not now",
      danger: false,
    });
    await screen.findByText("Set as primary?");

    expect(screen.getByRole("button", { name: "Yes, set it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();

    // Settle it — the confirm() singleton's state is module-level, not
    // component-level, so an unresolved dialog here would leak into
    // whichever test runs next in this file.
    await user.click(screen.getByRole("button", { name: "Not now" }));
    await resultPromise;
  });

  it("renders nothing when no confirmation is pending", () => {
    const { container } = render(<ConfirmDialogHost />);
    expect(container).toBeEmptyDOMElement();
  });
});
