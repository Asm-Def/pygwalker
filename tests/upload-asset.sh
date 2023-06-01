HERE=$(dirname $0)
VERSION=0.1.8.dev1
(cd $HERE/..; gh release delete-asset $VERSION pygwalker-${VERSION}-py3-none-any.whl; gh release upload $VERSION ./dist/pygwalker-${VERSION}-py3-none-any.whl;)
