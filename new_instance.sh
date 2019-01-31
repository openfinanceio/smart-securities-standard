#! /bin/bash

workspace=/tmp/s3-$(date +%s)
mkdir $workspace

if [ $# -lt 5 ]; then
  echo "USAGE"
  echo "\tnew_instance.sh <controller> <cosignerA> <cosignerB> <cosignerC> <resolver>"
fi

# Generate some configuration files

jq \
  --arg controller $1 \
  '.controller = $controller | .gasReportPath = "extra/gasPrices.json"' \
  < extra/conf.stub.json \
  > $workspace/conf.json

cosA=$2
cosB=$3
cosC=$4
resolver=$5

jq \
  --arg cosA $cosA \
  --arg cosB $cosB \
  --arg cosC $cosC \
  '.cosignerA = $cosA | .cosignerB = $cosB | .cosignerC = $cosC' \
  < extra/admin-spec.stub.json \
  > $workspace/admin-spec.json

# Deploy a fresh captables and administration contract

npm run cli -- init \
  --config $workspace/conf.json \
  --output $workspace/capTables.json

npm run cli -- new-administration \
  --config $workspace/conf.json \
  --spec $workspace/admin-spec.json \
  --output $workspace/admin.json


capTables=$(jq -r .[0].data.capTables $workspace/capTables.json)
admin=$(jq -r .adminAddress $workspace/admin.json)

# Generate more configuration files

jq \
  --arg capTables $capTables \
  --arg resolver $resolver \
  --arg securityPath $workspace/security.json \
  '.capTables = $capTables | .resolver = $resolver | .securityPaths = [ $securityPath ]' \
  <(echo '{}') \
  > $workspace/spec.json

jq \
  --arg admin $admin \
  --arg resolver $resolver \
  '.admin = $admin | .resolver = $resolver | .investors = []' \
  < extra/security.stub.json |
  jq --arg investorA $cosA \
    '.investors[0].address = $investorA | .investors[0].amount = "100000"' |
  jq --arg investorB $cosB \
    '.investors[1].address = $investorB | .investors[1].amount = "10000"' \
    > $workspace/security.json

# Setup complete, now issue

npm run cli -- issue-online \
  --config $workspace/conf.json \
  --declaration $workspace/spec.json \
  --output $workspace/report.json

# Report results

jq \
  --arg admin $admin \
  --arg resolver $resolver \
  --arg cosA $cosA \
  --arg cosB $cosB \
  --arg cosC $cosC \
  '.ethState | .admin = $admin | .resolver = $resolver | .cosignerA = $cosA | .cosignerB = $cosB | .cosignerC = $cosC' \
  $workspace/report.json
