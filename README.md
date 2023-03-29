# starter-kit

## Setup

1. Clone the repo:

	`git clone https://github.com/solusmax/starter-kit.git "new-project"`

2. Navigate to created directory:

	`cd "new-project"`

3. Remove unnecessary:

	`rm -rf "./.git/" "./package-lock.json"`

	`find . -type f -name ".gitkeep" -delete`

	`echo -n "" > "./README.md"`

4. Install dependencies:

	`npm i`
