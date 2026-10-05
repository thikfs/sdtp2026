# Set up your team project

This is for session 4. It takes about one hour.
Do the parts in order. Each part says who does it.

Your team has two people:

- **Delivery Lead.** Makes the team repository and the website.
- **Product and Quality Lead.** Fills in the team files and checks the tests.

Both people do Parts 1, 3, 4 and 5 on their own laptop.

Words you will meet:

- **Repository**: your team's shared folder on GitHub.
- **Commit**: a saved step of your work, with a short note.
- **Branch**: a safe copy where you try one change.
- **Pull request**: you ask your partner to check your change before it goes into `main`.
- **main**: the team's real version. The website shows `main`.
- **CI**: GitHub tests your change by itself. A green tick means the tests passed.
- **Dev URL**: the web address of your team's app.

---

## Part 0. Check your laptop

Everyone. 3 minutes.

1. Open **VS Code**.
2. At the top, click **Terminal**, then **New Terminal**.
3. Type `node -v` and press Enter.
4. Type `git --version` and press Enter.

**Check:** you see a number after each one. Node must start with `v22` or higher.

**Stuck?**

- No number, or "not recognized": install Node from [nodejs.org](https://nodejs.org). Pick the version marked **LTS**. Then close VS Code and open it again.
- Still stuck: use **Plan B** at the end of this page. It works in the browser.

---

## Part 1. Tell Git your name

Everyone. 3 minutes.

GitHub puts your name on every commit. Your teacher sees your work by this name.
If the name is wrong, your work does not count as yours.

1. Go to [github.com](https://github.com) and sign in.
2. Click your picture, top right. Click **Settings**.
3. On the left, click **Emails**.
4. Find the address that ends with `@users.noreply.github.com`. Copy it.
5. In the VS Code terminal, type these two lines. Use your own name and the address you copied.

```
git config --global user.name "Your Name"
git config --global user.email "12345678+yourname@users.noreply.github.com"
```

**Check:** type `git config --global user.email`. You see your address.

---

## Part 2. Make the team repository

Delivery Lead only. 5 minutes.

Pick **one** path.

### Path A. Your team has no repository yet

1. Open [github.com/dizdev/pr520-template](https://github.com/dizdev/pr520-template).
2. Click the green button **Use this template**.
3. Click **Create a new repository**.
4. **Owner**: you.
5. **Repository name**: a short team name, like `dental-booking`. No spaces.
6. Choose **Public**.
7. Click **Create repository**.

Why public? The free website only builds your partner's work when the repository is public.

### Path B. Your team already made a repository from the template

Your repository is from before 28 September. It has the documents but no app yet.
Do Part 3 first, so the folder is on your laptop. Then come back here.

In the VS Code terminal, type these two lines, one at a time:

```
git fetch https://github.com/dizdev/pr520-template main
```

```
git checkout FETCH_HEAD -- package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json src public playwright.config.ts tests/a11y .github/workflows .gitignore .devcontainer .vscode/extensions.json docs/SETUP.md mcp/server.ts
```

This copies the app into your folder. Your own documents stay as they are.
Then check your repository is **Public**: on GitHub, click **Settings**, scroll to **Danger Zone**, and look at **Change visibility**.
Now do Part 4. In Part 5, save these new files in the same commit as your change.

### Add your partner

Both paths. Delivery Lead only.

1. In your repository, click **Settings**.
2. On the left, click **Collaborators**.
3. Click **Add people**. Type your partner's GitHub name. Click **Add**.

Partner: open your email or [github.com/notifications](https://github.com/notifications). Click **Accept invitation**.

**Check:** your partner opens the repository link and sees the files.

---

## Part 3. Copy the repository to your laptop

Everyone. 5 minutes.

This is called **clone**.

1. In VS Code, press `Ctrl+Shift+P`. On a Mac, press `Cmd+Shift+P`.
2. Type `Git: Clone` and press Enter.
3. Click **Clone from GitHub**. If VS Code asks, sign in to GitHub.
4. Click your team repository.
5. Pick a folder, for example **Documents**.
6. When VS Code asks, click **Open**.

**Check:** on the left you see `src`, `docs` and `README.md`.

---

## Part 4. Run the app

Everyone. 5 minutes.

1. Click **Terminal**, then **New Terminal**.
2. Type `npm install` and press Enter. Wait 1 or 2 minutes.
3. Type `npm run dev` and press Enter.
4. You see a link: `http://localhost:5173`. Hold `Ctrl` (Mac: `Cmd`) and click it.

**Check:** the page says **Our product** and **It works. Your app is running.**

Keep this terminal open. The app stops when you close it.
To stop it yourself, click in the terminal and press `Ctrl+C`.

**Stuck?**

| You see | Do this |
|---|---|
| `npm` is not recognized | Node is missing. Go back to Part 0. |
| Windows: "running scripts is disabled" | Type `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and press `Y`. Try again. |
| `Port 5173 is in use` | Use the new link it prints, or close the other terminal. |
| The page is blank | Look at the terminal for red text. Ask your agent: "Explain this error in simple words." Paste the red text. |

---

## Part 5. Make your first change

Everyone. 15 minutes.

You each change one different file, so your changes do not clash.

- **Delivery Lead**: in `src/App.tsx`, change the line `<h1>Our product</h1>` to your product name.
- **Product and Quality Lead**: in `README.md`, fill in the team table. Write both names and roles.

Save the file with `Ctrl+S` (Mac: `Cmd+S`).
Delivery Lead: look at the browser. **Check:** the new name shows at once.

Now send your change to GitHub.

1. Look at the bottom-left corner of VS Code. It says **main**. Click it.
2. Click **Create new branch**. Type a name, like `product-name`. Press Enter.
3. On the left, click the **Source Control** icon. It looks like three dots joined by lines.
4. Look at the changed lines. Are they the ones you meant?
5. In the box, type a short note, like `Show our product name`.
6. Click **Commit**. If VS Code asks to stage all changes, click **Yes**.
7. Click **Publish Branch**.

Now open your repository on GitHub.

8. You see a yellow bar with **Compare & pull request**. Click it.
9. Click **Create pull request**.
10. Wait about 2 minutes. Look for the checks at the bottom.

**Check:** you see a green tick next to **CI**.

11. Ask your partner to read the change. They click **Files changed**.
12. Click **Merge pull request**, then **Confirm merge**.
13. In VS Code, click the branch name bottom-left. Pick **main**.
14. Click the circle arrows next to it. This is **Sync**. It brings the new `main` to your laptop.

**Stuck?**

| You see | Do this |
|---|---|
| A red cross next to CI | Click **Details**. Click the red step. Copy the last lines. Ask your agent: "CI failed with this. Explain it simply and suggest one fix." |
| Git asks for a password | Click the person icon, bottom-left in VS Code. Sign in with GitHub. |
| `Permission denied` | Your partner has not accepted the invitation yet. See Part 2. |
| `merge conflict` | Stop. Call the teacher. Do not delete files. |

If you already know Git, you can use the terminal:

```
git switch -c product-name
git add .
git commit -m "Show our product name"
git push -u origin product-name
```

---

## Part 6. Put the app on the internet

Delivery Lead only. 10 minutes.

We use **Vercel**. It is free. It builds your app every time `main` changes.

1. Go to [vercel.com/signup](https://vercel.com/signup).
2. Choose **Hobby**. Type your name.
3. Click **Continue with GitHub**.
4. Click **Add New...**, then **Project**.
5. Find your team repository. Click **Import**.
6. Do not change anything. Vercel sees **Vite** by itself. Click **Deploy**.
7. Wait about 1 minute.

**Check:** you see **Congratulations**. Click the picture of your site. It opens.

8. Copy the address. It looks like `https://dental-booking.vercel.app`.
   This is your **dev URL**. Send it to your partner.

**Stuck?**

| You see | Do this |
|---|---|
| Your repository is not in the list | Click **Adjust GitHub App Permissions**. Allow your repository. |
| "Deployment Blocked" or "commit author does not have contributing access" | Your repository is private. Make it **Public** (see Part 2). Check Part 1 for both people. |
| The site shows the old heading | Wait 1 minute. Did you merge the pull request? Only `main` goes live. |

---

## Part 7. Fill in the team files

Product and Quality Lead. 15 minutes.

Use a branch and a pull request, like Part 5.

1. `README.md`: product name, one-sentence statement, dev URL, board link.
2. `AGENTS.md`: replace `[Team name]` and `[dev URL]`.
3. `docs/PRODUCT.md`: paste your G1 work.
4. `docs/REQUIREMENTS.md`: paste your G2 work.
5. `docs/DECISIONS.md`: write today's date and which tools you chose.

You can ask your agent to help. Paste this, with your own words in the brackets:

```
Read AGENTS.md and README.md.
Replace [Team name] with <our team name>.
Replace [dev URL] with <our dev URL>.
Change nothing else.
Then list every line you changed.
```

Always read what the agent changed before you commit.

---

## Part 8. Make the board

Delivery Lead or Product and Quality Lead. 10 minutes.

A board is your team's to-do wall.

1. Click your picture, top right on GitHub. Click **Your projects**.
2. Click **New project**. Pick **Board**. Give it your team name. Click **Create project**.
3. Add 5 cards. One card for each milestone in `docs/REQUIREMENTS.md`. These are your **epics**.
4. Add your first stories as more cards in **Todo**.
5. Click the three dots, top right. Click **Settings**. Find **Visibility** and choose **Public**.
6. Under **Manage access**, add your partner.
7. Copy the board address. Put it in `README.md`.

Why public? The teacher cannot see a private board.

---

## Part 9. Check CI on main

Everyone. 2 minutes.

1. Open your repository on GitHub.
2. Click **Actions**.
3. Look at the top line. It says `main`.

**Check:** it has a green tick. Click it and copy the address. You need it for G3.

---

## Part 10. Hand in G3

Delivery Lead posts the link on moodle. Due **05.10.2026, 09:00**.

In Moodle, open **Project setup**. Post three links:

1. The repository.
2. The dev URL.
3. The board.


---

## Later, only if you need it: a database

Most teams do not need a database yet.
Add one when a story must save data, like bookings or messages.
Ask the teacher first. Then write why in `docs/DECISIONS.md`.
Session 8 shows how.

---

## Plan B: no Node on your laptop

Use **GitHub Codespaces**. It is VS Code in your browser, with everything installed.

1. Open your team repository on GitHub.
2. Click the green **Code** button.
3. Click the **Codespaces** tab.
4. Click **Create codespace on main**.
5. Wait 2 or 3 minutes. It installs the app for you.
6. In the terminal, type `npm run dev`.
7. A box appears. Click **Open in Browser**.

**Check:** the page says **Our product**.

A personal GitHub account can use this for free for many hours each month.
When you finish for the day, close the tab. GitHub stops it by itself.
