# from bs4 import BeautifulSoup
# import requests
# import csv

# def scrape_table_data(url):
#     # Send a GET request to the URL
#     response = requests.get(url)

#     # Check if the request was successful
#     if response.status_code == 200:
#         # Parse the HTML content of the page
#         soup = BeautifulSoup(response.content, "html.parser")
        
#         # Initialize a list to store the scraped data
#         data = []
        
#         # Find all tables with the specified attributes
#         target_tables = soup.find_all("table", attrs={"border": "0", "cellspacing": "0", "cellpadding": "0", "width": "650", "align": "center"})
        
#         # Iterate over each table
#         for table in target_tables:
#             # Check if the table has a specific background color, skipping if true
#             if table.find("td", class_="textehome", bgcolor="#56E119"):
#                 continue
            
#             # Initialize a dictionary to store data for each table
#             table_data = {}
            
#             # Find all tr elements within the table
#             tr_elements = table.find_all("tr") 
            
#             # Iterate over each tr element
#             for tr in tr_elements:
#                 # Check if the tr element contains td elements with class "textehome"
#                 if tr.find("td", class_="textehome"):
#                     # Check if the td element belongs to class "switchcontent"
#                     if not tr.find_parent("td", class_="switchcontent"):
#                         # Extract text from each td element and store it in the dictionary
#                         td_elements = tr.find_all("td", class_="textehome")
#                         table_data["Title"] = td_elements[0].get_text(strip=True)
#                         table_data["Date"] = td_elements[1].get_text(strip=True)
#                         table_data["Last Updated"] = td_elements[3].get_text(strip=True)
            
#             # Find all font elements with class "textehome"
#             font_elements = table.find_all("font", class_="textehome")
            
#             # Extract text from each font element and store it in the dictionary
#             description = font_elements[0].get_text(strip=True).strip()
#             sentences = description.split(".")
            
#             # Separate sentences starting with "signale" from the rest
#             signale_sentences = [sentence.strip() for sentence in sentences if sentence.startswith("signale")]
#             other_sentences = [sentence.strip() for sentence in sentences if not sentence.startswith("signale")]
            
#             # Reconstruct the description text
#             reconstructed_description = ". ".join(other_sentences) + ". " + ". ".join(signale_sentences)
            
#             # Append the reconstructed description to the data dictionary
#             table_data["Description"] = reconstructed_description
            
#             # Append the dictionary to the list
#             data.append(table_data)
        
#         return data
            
#     else:
#         print("Failed to retrieve the webpage.")
#         return None

# # Function to write data to a CSV file
# def write_to_csv(data):
#     # Specify the CSV file name
#     csv_file = "scraped_data.csv"
    
#     # Define fieldnames for the CSV file
#     fieldnames = ["Title", "Date", "Last Updated", "Description"]
    
#     # Write data to the CSV file
#     with open(csv_file, mode='w', newline='', encoding='utf-8') as file:
#         writer = csv.DictWriter(file, fieldnames=fieldnames)
#         writer.writeheader()
#         for entry in data:
#             writer.writerow(entry)

# # URL of the webpage to scrape
# url = "https://www.inforoutes.be/"

# # Call the function to scrape data from the target tables
# scraped_data = scrape_table_data(url)

# if scraped_data is not None:  # Check if the scraping was successful
#     # Print the data from the target tables
#     for index, entry in enumerate(scraped_data, start=1):
#         print(f"Entry {index}:")
#         print("Title:", entry["Title"])
#         print("Date:", entry["Date"])
#         print("Last Updated:", entry["Last Updated"])
#         print(entry["Description"])
#         print("-" * 50)
    
#     # Write data to CSV file
#     write_to_csv(scraped_data)
#     print("Data has been successfully saved to 'scraped_data.csv'")
# else:
#     print("No data available.")
import requests
import csv
from bs4 import BeautifulSoup
import subprocess
import os

# Function to fetch latitude and longitude using Google Maps Geocoding API
def fetch_lat_lng(location_name, api_key):
    base_url = f'https://maps.googleapis.com/maps/api/geocode/json?address={location_name}&key={api_key}'
    
    try:
        response = requests.get(base_url)
        response.raise_for_status()  # Raise an error for non-200 status codes
        
        data = response.json()
        if data['status'] == 'OK':
            lat_lng = data['results'][0]['geometry']['location']
            return lat_lng['lat'], lat_lng['lng']
    except requests.exceptions.RequestException as e:
        print(f"Error fetching lat/lng for {location_name}: {e}")
    except KeyError:
        print(f"No lat/lng found for {location_name}")
    
    return None, None

def scrape_table_data(url):
    # Send a GET request to the URL
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for non-200 status codes
        
        # Parse the HTML content of the page
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Initialize a list to store the scraped data
        data = []
        
        # Find all tables with the specified attributes
        target_tables = soup.find_all("table", attrs={"border": "0", "cellspacing": "0", "cellpadding": "0", "width": "650", "align": "center"})
        
        # Iterate over each table
        for table in target_tables:
            # Check if the table has a specific background color, skipping if true
            if table.find("td", class_="textehome", bgcolor="#56E119"):
                continue
            
            # Initialize a dictionary to store data for each table
            table_data = {}
            
            # Find all tr elements within the table
            tr_elements = table.find_all("tr") 
            
            # Iterate over each tr element
            for tr in tr_elements:
                # Check if the tr element contains td elements with class "textehome"
                if tr.find("td", class_="textehome"):
                    # Check if the td element belongs to class "switchcontent"
                    if not tr.find_parent("td", class_="switchcontent"):
                        # Extract text from each td element and store it in the dictionary
                        td_elements = tr.find_all("td", class_="textehome")
                        table_data["Title"] = td_elements[0].get_text(strip=True)
                        table_data["Date"] = td_elements[1].get_text(strip=True)
                        table_data["Last Updated"] = td_elements[3].get_text(strip=True)
            
            # Find all font elements with class "textehome"
            font_elements = table.find_all("font", class_="textehome")
            
            # Extract text from each font element and store it in the dictionary
            description = font_elements[0].get_text(strip=True).strip()
            sentences = description.split(".")
            
            # Separate sentences starting with "signale" from the rest
            signale_sentences = [sentence.strip() for sentence in sentences if sentence.startswith("signale")]
            other_sentences = [sentence.strip() for sentence in sentences if not sentence.startswith("signale")]
            
            # Reconstruct the description text
            reconstructed_description = ". ".join(other_sentences) + ". " + ". ".join(signale_sentences)
            
            # Append the reconstructed description to the data dictionary
            table_data["Description"] = reconstructed_description
            
            # Append the dictionary to the list
            data.append(table_data)
        
        return data
    except requests.exceptions.RequestException as e:
        print(f"Failed to retrieve the webpage: {e}")
        return None

# Function to write data to a CSV file
def write_to_csv(data, file_path):
    # Define fieldnames for the CSV file
    fieldnames = ["Title", "Date", "Last Updated", "Description", "Latitude", "Longitude"]
    
    # Write data to the CSV file
    with open(file_path, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for entry in data:
            writer.writerow(entry)

# URL of the webpage to scrape
url = "https://www.inforoutes.be/"

# API key for Google Maps Geocoding API
api_key = os.getenv("GOOGLE_MAPS_API_KEY")  # Retrieve API key from environment variable

# Call the function to scrape data from the target tables
scraped_data = scrape_table_data(url)

if scraped_data is not None:  # Check if the scraping was successful
    # Fetch latitude and longitude for each location
    for entry in scraped_data:
        location_name = entry["Title"]
        latitude, longitude = fetch_lat_lng(location_name, api_key)
        entry["Latitude"] = latitude
        entry["Longitude"] = longitude
    
    # Specify the CSV file path
    csv_file = "scraped_data.csv"
    
    # Write data to CSV file
    write_to_csv(scraped_data, csv_file)
    print("Data has been successfully saved to 'scraped_data.csv'")
    
    # Run LatLanPolice.py script if all operations were successful
    try:
        subprocess.run(["python", "src/scrap/LatLanPolice.py"], check=True)
        print("Data scraped successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error running LatLanPolice.py script: {e}")
else:
    print("No data available.")
