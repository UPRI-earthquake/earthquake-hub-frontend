#!/bin/sh

# Check if the .env file exists and load environment variables from it
if [ -f ".env" ]; then
  echo "Loading environment variables from .env file..."
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if the config.js file path is provided as a positional argument
if [ -z "$1" ]; then
  echo "Error: Missing path to config.js file"
  echo "Usage: ./import-env.sh <path-to-config.js>."
  exit 1
fi

# Create or overwrite the specified config.js file
echo "window['ENV'] = {" > "$1"

# Get all environment variables starting with REACT_APP_
env_variables=$(env | grep '^REACT_APP_')

# Loop through each variable and write it to the config.js file
# first set Internal Field Separator to newline
IFS='
'
# loop on each line
for line in $env_variables; do
  key=$(echo "$line" | cut -d'=' -f1)
  value=$(echo "$line" | cut -d'=' -f2-)
  echo "  $key:\"$value\"," 
  echo "  $key:\"$value\"," >> "$1"
done

# Close the config.js file
echo "}" >> "$1"

echo "Configuration file ($1) has been generated with REACT_APP_ env vars."

# check environment and get all vars that start with REACT_APP_
# for each of the vars, write them on env.js available in this path ./public/env.js
# the format would be:
#
#window['ENV'] = {
#  REACT_APP_ENV_VAR1:"some value",
#  REACT_APP_ENV_VAR2:"some value2"
#}
