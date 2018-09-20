#! /bin/bash

gittop=$(git rev-parse --show-toplevel)
cd $gittop
cp ./githooks/pre-commit .git/hooks
