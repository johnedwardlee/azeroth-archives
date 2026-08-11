function showStartupError(reason: unknown) {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error("Azeroth Archives startup failed", error);
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = "";
  const main = document.createElement("main");
  main.className = "startup-error";
  const heading = document.createElement("h1");
  heading.textContent = "Azeroth Archives could not open";
  const detail = document.createElement("p");
  detail.textContent = error.message;
  const reload = document.createElement("button");
  reload.textContent = "Reload application";
  reload.addEventListener("click", () => window.location.reload());
  main.append(heading, detail, reload);
  root.append(main);
}

void import("./main").catch(showStartupError);
