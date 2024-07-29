import csv

# Function to remove surrounding double quotes from a string
def remove_quotes(string):
    return string.strip('"')

# Input and output file paths
input_file = "formatted_data.csv"
output_file = "modified_data.csv"

# Open input and output files
with open(input_file, 'r') as csv_in, open(output_file, 'w', newline='') as csv_out:
    reader = csv.reader(csv_in)
    writer = csv.writer(csv_out)

    # Iterate over each row in the input CSV file
    for row in reader:
        # Remove surrounding double quotes from each element in the row
        modified_row = [remove_quotes(element) for element in row]
        
        # Write the modified row to the output CSV file
        writer.writerow(modified_row)

print("Modification completed. Modified data saved in 'modified_data.csv'.")
