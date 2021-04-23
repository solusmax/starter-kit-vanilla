# starter-kit

## Установка

1. Склонировать репозиторий:

	`git clone https://github.com/solusmax/starter-kit.git "new-project"`

2. Перейти в созданный каталог:

	`cd "new-project"`

3. Удалить лишнее:

	`rm -rf "./.git/" "./CHANGELOG.md" "./package-lock.json"`

	`find . -type f -name ".gitkeep" -delete`

	`echo -n "" > "./README.md"`

4. Установить зависимости:

	`npm i`
