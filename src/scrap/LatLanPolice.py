import csv

input_file = "scraped_data.csv"
output_file = "coordinates.csv"

with open(input_file, mode='r', encoding='utf-8-sig') as csv_file:
    csv_reader = csv.DictReader(csv_file)
    with open(output_file, mode='w', newline='', encoding='utf-8') as output:
        writer = csv.writer(output)
        for row in csv_reader:
            latitude = row["Latitude"]
            longitude = row["Longitude"]
            if latitude and longitude:  # Check if both latitude and longitude are available
                # Remove the first and last characters from the string
              
                writer.writerow([latitude,longitude])
            else:
                writer.writerow(["LatLng()"])

print("Coordinates extracted and saved successfully.")
