# private/

**Real data lives here and nothing in it is committed.** The repository is
public by the owner's explicit choice, so a client list in `fixtures/` would be
a disclosure of thirty-five named people the moment it was pushed.

Drop client exports, credentials and anything else identifying here. The
`.gitignore` in this folder ignores everything except itself and this file, so
the safe default is "not committed" and adding a file is not a decision anyone
has to remember to make correctly.

Scripts that read from here take a path argument rather than hardcoding one, so
nothing breaks for someone who does not have the file.
